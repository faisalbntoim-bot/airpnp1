/**
 * Admin-driven property compliance transitions.
 *
 * Enforces the REGA advertisement lifecycle:
 *
 *   DRAFT → SUBMITTED  (owner submits for verification — via a future endpoint)
 *   SUBMITTED → VERIFIED  (admin verifies + records the REGA licence number)
 *   VERIFIED → PUBLISHED  (admin publishes — property becomes 'available' to public)
 *   PUBLISHED → SUSPENDED (admin can suspend on complaint / regulator request)
 *   SUSPENDED → PUBLISHED (admin can lift suspension)
 *   PUBLISHED → EXPIRED   (auto or manual — licence past `regaLicenseExpiresAt`)
 *   any → REMOVED         (admin permanently removes)
 *
 * Once PUBLISHED, `regaLicenseNumber`, `regaLicenseIssuedAt`, `regaLicenseExpiresAt`
 * cannot be edited via this route — they can only be changed by a full
 * re-verification through the SUSPENDED → SUBMITTED → VERIFIED path.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '../db.js';
import { requireRole } from '../auth/rbac.js';
import { audit } from '../audit.js';
import { badRequest, conflict, notFound } from '../errors.js';
import { jsonSafe } from '../money.js';

const submitSchema = z.object({});
const verifySchema = z.object({
  regaLicenseNumber: z.string().min(3).max(80),
  regaLicenseIssuedAt: z.string().datetime(),
  regaLicenseExpiresAt: z.string().datetime(),
  regaComplianceRef: z.string().max(200).optional(),
});
const suspendSchema = z.object({ reason: z.string().min(3).max(500) });

const TERMINAL = new Set(['REMOVED']);
const ALLOWED: Record<string, string[]> = {
  DRAFT:      ['SUBMITTED', 'REMOVED'],
  SUBMITTED:  ['VERIFIED', 'DRAFT', 'REMOVED'],
  VERIFIED:   ['PUBLISHED', 'SUSPENDED', 'REMOVED'],
  PUBLISHED:  ['SUSPENDED', 'EXPIRED', 'REMOVED'],
  SUSPENDED:  ['SUBMITTED', 'PUBLISHED', 'REMOVED'],
  EXPIRED:    ['SUBMITTED', 'REMOVED'],
  REMOVED:    [],
};

function assertTransition(from: string, to: string): void {
  if (TERMINAL.has(from)) throw conflict(`property is ${from} — no further transitions allowed`);
  if (!ALLOWED[from]?.includes(to)) throw conflict(`illegal transition ${from} → ${to}`);
}

export default async function adminPropertyRoutes(app: FastifyInstance) {
  const adminOnly = requireRole(['ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN']);

  app.post('/v1/admin/properties/:id/submit', async (req, reply) => {
    const caller = adminOnly(req, reply);
    const { id } = req.params as { id: string };
    submitSchema.parse(req.body ?? {});
    const prisma = getPrisma();
    const p = await prisma.property.findUnique({ where: { id } });
    if (!p) throw notFound('property not found');
    assertTransition(p.advertisementLifecycle, 'SUBMITTED');
    const updated = await prisma.property.update({
      where: { id },
      data: { advertisementLifecycle: 'SUBMITTED', regaSubmittedAt: new Date() },
    });
    await audit({ actorId: caller.userId, action: 'PROPERTY.SUBMITTED', entity: 'Property', entityId: id });
    return jsonSafe(updated);
  });

  app.post('/v1/admin/properties/:id/mark-verified', async (req, reply) => {
    const caller = adminOnly(req, reply);
    const { id } = req.params as { id: string };
    const body = verifySchema.parse(req.body);
    const issuedAt  = new Date(body.regaLicenseIssuedAt);
    const expiresAt = new Date(body.regaLicenseExpiresAt);
    if (expiresAt.getTime() <= issuedAt.getTime()) throw badRequest('regaLicenseExpiresAt must be after issuedAt');

    const prisma = getPrisma();
    const p = await prisma.property.findUnique({ where: { id } });
    if (!p) throw notFound('property not found');
    assertTransition(p.advertisementLifecycle, 'VERIFIED');
    const updated = await prisma.property.update({
      where: { id },
      data: {
        advertisementLifecycle: 'VERIFIED',
        regaLicenseNumber: body.regaLicenseNumber,
        regaLicenseIssuedAt: issuedAt,
        regaLicenseExpiresAt: expiresAt,
        regaComplianceRef: body.regaComplianceRef ?? null,
        regaVerifiedAt: new Date(),
        regaVerifiedByUserId: caller.userId,
      },
    });
    await audit({
      actorId: caller.userId, action: 'PROPERTY.VERIFIED', entity: 'Property', entityId: id,
      after: JSON.stringify({ regaLicenseNumber: body.regaLicenseNumber }),
    });
    return jsonSafe(updated);
  });

  app.post('/v1/admin/properties/:id/publish', async (req, reply) => {
    const caller = adminOnly(req, reply);
    const { id } = req.params as { id: string };
    const prisma = getPrisma();
    const p = await prisma.property.findUnique({ where: { id } });
    if (!p) throw notFound('property not found');
    assertTransition(p.advertisementLifecycle, 'PUBLISHED');
    if (!p.regaLicenseNumber || !p.regaLicenseExpiresAt) {
      throw conflict('cannot publish without a REGA licence number + expiry');
    }
    if (p.regaLicenseExpiresAt.getTime() < Date.now()) {
      throw conflict('REGA licence has already expired');
    }
    const updated = await prisma.property.update({
      where: { id },
      data: { advertisementLifecycle: 'PUBLISHED', status: 'available' },
    });
    await audit({ actorId: caller.userId, action: 'PROPERTY.PUBLISHED', entity: 'Property', entityId: id });
    return jsonSafe(updated);
  });

  app.post('/v1/admin/properties/:id/suspend', async (req, reply) => {
    const caller = adminOnly(req, reply);
    const { id } = req.params as { id: string };
    const body = suspendSchema.parse(req.body);
    const prisma = getPrisma();
    const p = await prisma.property.findUnique({ where: { id } });
    if (!p) throw notFound('property not found');
    assertTransition(p.advertisementLifecycle, 'SUSPENDED');
    const updated = await prisma.property.update({
      where: { id },
      data: {
        advertisementLifecycle: 'SUSPENDED',
        status: 'hidden',
        regaSuspendedAt: new Date(),
        regaSuspendReason: body.reason,
      },
    });
    await audit({ actorId: caller.userId, action: 'PROPERTY.SUSPENDED', entity: 'Property', entityId: id, after: JSON.stringify({ reason: body.reason }) });
    return jsonSafe(updated);
  });
}
