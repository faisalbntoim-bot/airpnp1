import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../auth/rbac.js';
import { createRefund } from '../financial/refund.js';
import { halalahsFromMajor, jsonSafe } from '../money.js';
import { newIdempotencyKey } from '../idempotency.js';

const refundSchema = z.object({
  amount: z.union([z.string(), z.number()]).optional(), // major units; omit = full refund
  reason: z.string().max(500).optional(),
});

export default async function refundRoutes(app: FastifyInstance) {
  app.post('/v1/payments/:id/refund', async (req, reply) => {
    const caller = requireRole(['ADMIN', 'OFFICE', 'HOST'])(req, reply);
    const { id } = req.params as { id: string };
    const body = refundSchema.parse(req.body ?? {});
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
