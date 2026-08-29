import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '../db.js';
import { requireAuth, isAdminRole } from '../auth/rbac.js';
import { startCheckout } from '../financial/payment.orchestrator.js';
import { newIdempotencyKey } from '../idempotency.js';
import { notFound } from '../errors.js';
import { jsonSafe } from '../money.js';

const startSchema = z.object({
  bookingId: z.string().min(1),
  returnUrl: z.string().url().optional(),
  customer: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  }).optional(),
});

export default async function paymentRoutes(app: FastifyInstance) {
  app.post('/v1/payments', async (req, reply) => {
    const caller = requireAuth(req, reply);
    const body = startSchema.parse(req.body);

    // IDOR guard: only the booking's customer (or an admin) may start its checkout.
    const booking = await getPrisma().booking.findUnique({ where: { id: body.bookingId } });
    if (!booking) throw notFound('booking not found');
    if (!isAdminRole(caller.role) && booking.customerId !== caller.userId) {
      throw notFound('booking not found');
    }

    const idempotencyKey =
      (req.headers['idempotency-key'] as string | undefined) ?? newIdempotencyKey();
    const result = await startCheckout({
      bookingId: body.bookingId,
      idempotencyKey,
      customer: body.customer,
      returnUrl: body.returnUrl,
    });
    return jsonSafe(result);
  });

  app.get('/v1/payments/:id', async (req, reply) => {
    const caller = requireAuth(req, reply);
    const { id } = req.params as { id: string };
    const payment = await getPrisma().payment.findUnique({
      where: { id },
      include: { booking: true, refunds: true, invoice: true },
    });
    if (!payment) throw notFound('payment not found');
    if (
      !isAdminRole(caller.role) &&
      payment.booking?.customerId !== caller.userId &&
      payment.booking?.hostId !== caller.userId
    ) {
      throw notFound('payment not found');
    }
    return jsonSafe(payment);
  });
}
