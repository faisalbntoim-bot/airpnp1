/**
 * Beneficiary + Payout routes.
 *
 * A beneficiary must be created and KYC-approved before any settlement is
 * eligible for payout. Card / IBAN data is never stored in our DB — the
 * provider tokenises it and we only keep the masked IBAN + provider id.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '../db.js';
import { requireAuth, requireRole } from '../auth/rbac.js';
import { getProvider } from '../providers/payment-provider.js';
import { requestPayout } from '../financial/payout.js';
import { markEligible } from '../financial/settlement.js';
import { jsonSafe } from '../money.js';
import { audit } from '../audit.js';
import { badRequest, notFound } from '../errors.js';

const createSchema = z.object({
  name: z.string().min(2),
  iban: z.string().regex(/^SA[0-9A-Z]{22}$/, 'expected a Saudi IBAN'),
  bankName: z.string().optional(),
});

export default async function beneficiaryRoutes(app: FastifyInstance) {
  app.post('/v1/beneficiaries', async (req, reply) => {
    const caller = requireAuth(req, reply);
    const body = createSchema.parse(req.body);
    const prisma = getPrisma();
    const existing = await prisma.beneficiary.findUnique({ where: { userId: caller.userId } });
    if (existing) throw badRequest('beneficiary already exists');

    const provider = await getProvider();
    const providerBeneficiary = await provider.createBeneficiary({
      name: body.name,
      iban: body.iban,
      countryCode: 'SA',
      bankName: body.bankName,
    });

    const created = await prisma.beneficiary.create({
      data: {
        userId: caller.userId,
        provider: provider.name,
        externalBeneficiaryId: providerBeneficiary.providerBeneficiaryId,
        ibanMasked: providerBeneficiary.ibanMasked ?? null,
        payoutEnabled: providerBeneficiary.status === 'active',
      },
    });
    await audit({ actorId: caller.userId, action: 'BENEFICIARY.CREATED', entity: 'Beneficiary', entityId: created.id });
    return jsonSafe(created);
  });

  app.get('/v1/beneficiaries/me', async (req, reply) => {
    const caller = requireAuth(req, reply);
    const b = await getPrisma().beneficiary.findUnique({ where: { userId: caller.userId } });
    if (!b) throw notFound('beneficiary not found');
    return jsonSafe(b);
  });

  // Admin marks a PENDING settlement ELIGIBLE (KYC + payoutEnabled must be true).
  app.post('/v1/admin/settlements/:id/mark-eligible', async (req, reply) => {
    const caller = requireRole(['ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN'])(req, reply);
    const { id } = req.params as { id: string };
    await markEligible(id);
    await audit({ actorId: caller.userId, action: 'SETTLEMENT.ELIGIBLE', entity: 'Settlement', entityId: id });
    return { ok: true };
  });

  // Trigger a payout on an ELIGIBLE settlement.
  app.post('/v1/admin/settlements/:id/payout', async (req, reply) => {
    const caller = requireRole(['ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN'])(req, reply);
    const { id } = req.params as { id: string };
    const res = await requestPayout({ settlementId: id, actorId: caller.userId });
    return jsonSafe(res);
  });
}
