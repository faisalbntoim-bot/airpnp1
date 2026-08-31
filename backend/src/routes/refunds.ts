import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '../db.js';
import { requireRole, isAdminRole } from '../auth/rbac.js';
import { createRefund } from '../financial/refund.js';
import { halalahsFromMajor, jsonSafe } from '../money.js';
import { newIdempotencyKey } from '../idempotency.js';
import { forbidden, notFound } from '../errors.js';

const refundSchema = z.object({
  amount: z.union([z.string(), z.number()]).optional(), // major units; omit = full refund
  reason: z.string().max(500).optional(),
});

export default async function refundRoutes(app: FastifyInstance) {
  app.post('/v1/payments/:id/refund', async (req, reply) => {
    const caller = requireRole(['ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN', 'OFFICE', 'HOST'])(req, reply);
    const { id } = req.params as { id: string };
    const body = refundSchema.parse(req.body ?? {});

    // IDOR guard: HOST/OFFICE can only refund a payment tied to a booking they serve.
    // Admins bypass the ownership check.
    if (!isAdminRole(caller.role)) {
      const payment = await getPrisma().payment.findUnique({
        where: { id },
        include: { booking: { include: { property: true } } },
      });
      if (!payment) throw notFound('payment not found');
      const b = payment.booking;
      const isHostOfBooking     = caller.role === 'HOST'    && b?.hostId === caller.userId;
      const isOwnerOfProperty   = caller.role === 'OFFICE'  && b?.property.ownerId === caller.userId;
      const isOfficeOfBooking   = caller.role === 'OFFICE'  && !!b?.officeId && b.officeId === caller.userId;
      if (!isHostOfBooking && !isOwnerOfProperty && !isOfficeOfBooking) {
        // 404 rather than 403 to avoid confirming that the id exists to unauthorised callers.
        throw notFound('payment not found');
      }
    }

    const idempotencyKey =
      (req.headers['idempotency-key'] as string | undefined) ?? newIdempotencyKey();

    const result = await createRefund({
      paymentId: id,
      idempotencyKey,
      amountHalalahs: body.amount != null ? halalahsFromMajor(body.amount) : undefined,
      reason: body.reason,
      actorId: caller.userId,
    });
    return jsonSafe(result);
  });
}
