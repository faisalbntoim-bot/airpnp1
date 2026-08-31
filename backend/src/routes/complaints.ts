/**
 * Complaints — required by REGA + PDPL for a real-estate platform.
 *
 * Anyone (authenticated or anonymous) can file a complaint against a
 * listing, booking, or platform conduct. Only admins can view or resolve
 * them. Attachments are references to `MediaAsset` rows, uploaded via the
 * signed-URL flow in `routes/media.ts` — the complaint itself never carries
 * a file blob.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '../db.js';
import { getCaller, requireRole, isAdminRole } from '../auth/rbac.js';
import { audit } from '../audit.js';
import { badRequest, notFound } from '../errors.js';
import { jsonSafe } from '../money.js';

const createSchema = z.object({
  category: z.enum(['advertisement', 'payment', 'conduct', 'other']).default('advertisement'),
  description: z.string().min(10).max(4000),
  propertyId: z.string().optional(),
  bookingId: z.string().optional(),
  attachmentIds: z.array(z.string()).max(10).optional(),
});

const resolveSchema = z.object({
  status: z.enum(['in_review', 'resolved', 'dismissed']),
  resolution: z.string().max(4000).optional(),
  adminNotes: z.string().max(4000).optional(),
});

export default async function complaintRoutes(app: FastifyInstance) {
  // Public: anyone can file. Auth is optional but recorded when present.
  app.post('/v1/complaints', async (req) => {
    const caller = getCaller(req);
    const body = createSchema.parse(req.body);
    if (!body.propertyId && !body.bookingId && body.category !== 'other' && body.category !== 'conduct') {
      throw badRequest('complaints against advertisement/payment must reference a propertyId or bookingId');
    }
    const prisma = getPrisma();
    const created = await prisma.complaint.create({
      data: {
        complainantId: caller?.userId ?? null,
        propertyId: body.propertyId ?? null,
        bookingId: body.bookingId ?? null,
        category: body.category,
        description: body.description,
        attachmentRefs: body.attachmentIds ? JSON.stringify(body.attachmentIds) : null,
      },
    });
    await audit({
      actorId: caller?.userId,
      action: 'COMPLAINT.CREATED',
      entity: 'Complaint',
      entityId: created.id,
      after: JSON.stringify({ category: body.category, propertyId: body.propertyId, bookingId: body.bookingId }),
    });
    return jsonSafe({ id: created.id, status: created.status, createdAt: created.createdAt });
  });

  // Admin: list. Callers with a HOST/OWNER/OFFICE role only see complaints against their own listings.
  app.get('/v1/complaints', async (req, reply) => {
    const caller = requireRole(['ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN', 'OFFICE', 'HOST', 'OWNER'])(req, reply);
    const q = z.object({
      status: z.enum(['open', 'in_review', 'resolved', 'dismissed']).optional(),
      page: z.coerce.number().int().min(1).max(1000).default(1),
      pageSize: z.coerce.number().int().min(1).max(50).default(20),
    }).parse(req.query ?? {});

    const prisma = getPrisma();
    let where: Record<string, unknown> = {};
    if (q.status) where.status = q.status;
    if (!isAdminRole(caller.role)) {
      where = { ...where, property: { ownerId: caller.userId } };
    }
    const [total, rows] = await Promise.all([
      prisma.complaint.count({ where }),
      prisma.complaint.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return jsonSafe({ items: rows, page: q.page, pageSize: q.pageSize, total });
  });

  app.get('/v1/complaints/:id', async (req, reply) => {
    const caller = requireRole(['ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN', 'OFFICE', 'HOST', 'OWNER'])(req, reply);
    const { id } = req.params as { id: string };
    const row = await getPrisma().complaint.findUnique({
      where: { id },
      include: { property: true },
    });
    if (!row) throw notFound('complaint not found');
    if (!isAdminRole(caller.role) && row.property?.ownerId !== caller.userId) {
      throw notFound('complaint not found');
    }
    return jsonSafe(row);
  });

  // Admin: resolve / dismiss / move to review.
  app.post('/v1/complaints/:id/resolve', async (req, reply) => {
    const caller = requireRole(['ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN'])(req, reply);
    const { id } = req.params as { id: string };
    const body = resolveSchema.parse(req.body);
    const prisma = getPrisma();
    const before = await prisma.complaint.findUnique({ where: { id } });
    if (!before) throw notFound('complaint not found');
    const updated = await prisma.complaint.update({
      where: { id },
      data: {
        status: body.status,
        resolution: body.resolution ?? null,
        adminNotes: body.adminNotes ?? null,
        resolvedAt: (body.status === 'resolved' || body.status === 'dismissed') ? new Date() : null,
        resolvedById: (body.status === 'resolved' || body.status === 'dismissed') ? caller.userId : null,
      },
    });
    await audit({
      actorId: caller.userId,
      action: `COMPLAINT.${body.status.toUpperCase()}`,
      entity: 'Complaint',
      entityId: id,
      before: JSON.stringify({ status: before.status }),
      after: JSON.stringify({ status: updated.status }),
    });
    return jsonSafe(updated);
  });
}
