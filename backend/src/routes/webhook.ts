/**
 * Payment provider webhook.
 *
 * Security posture:
 *   1. Raw body is verified against the provider's HMAC signature.
 *   2. Duplicate `(provider, externalEventId)` events are stored once and skipped
 *      on replay (this is our idempotency guarantee against retried webhooks).
 *   3. NEVER trust the client for "paid" — only a verified webhook (or a signed
 *      server-side verifyPayment) may capture a payment.
 */

import type { FastifyInstance } from 'fastify';
import { getPrisma } from '../db.js';
import { getProvider } from '../providers/payment-provider.js';
import { capturePayment } from '../financial/payment.orchestrator.js';

export default async function webhookRoutes(app: FastifyInstance) {
  // Preserve raw body for HMAC verification.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      try {
        const raw = (body as Buffer).toString('utf8');
        const parsed = raw.length ? JSON.parse(raw) : {};
        done(null, { __raw: raw, ...parsed });
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  app.post('/v1/payments/webhook', async (req, reply) => {
    const provider = await getProvider();
    const rawBody = (req.body as { __raw?: string } | undefined)?.__raw ?? '';
    const headers: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      headers[k] = Array.isArray(v) ? v[0] : (v as string | undefined);
    }

    let verified;
    try {
      verified = await provider.verifyWebhook({ rawBody, headers });
    } catch (err) {
      req.log.warn({ err }, 'webhook signature verification failed');
      reply.code(400);
      return { ok: false, error: 'invalid signature' };
    }

    const prisma = getPrisma();
    // Dedup by (provider, externalEventId). If we've seen it, ack immediately.
    const existing = await prisma.webhookEvent.findUnique({
      where: {
        provider_externalEventId: {
          provider: provider.name,
          externalEventId: verified.externalEventId,
        },
      },
    });
    if (existing?.processed) {
      return { ok: true, duplicate: true };
    }
    const evtRow =
      existing ??
      (await prisma.webhookEvent.create({
        data: {
          provider: provider.name,
          externalEventId: verified.externalEventId,
          eventType: verified.eventType,
          signatureVerified: true,
          processed: false,
          payload: rawBody,
        },
      }));

    // Route the event type.
    try {
      if (verified.eventType === 'payment.captured' && verified.paymentId && verified.providerPaymentId) {
        await capturePayment({
          paymentId: verified.paymentId,
          providerPaymentId: verified.providerPaymentId,
          reportedAmountHalalahs: verified.amountHalalahs,
          reportedCurrency: verified.currency,
        });
      } else if (verified.eventType === 'payment.failed' && verified.paymentId) {
        await prisma.payment.updateMany({
          where: { id: verified.paymentId, status: 'pending' },
          data: { status: 'failed', providerStatus: 'failed' },
        });
        await prisma.paymentEvent.create({
          data: { paymentId: verified.paymentId, kind: 'failed', data: rawBody },
        });
      }
      // Other event types are recorded but not acted on.

      await prisma.webhookEvent.update({
        where: { id: evtRow.id },
        data: { processed: true, processedAt: new Date() },
      });
      return { ok: true };
    } catch (err) {
      req.log.error({ err }, 'webhook processing failed');
      reply.code(500);
      return { ok: false, error: 'processing failed' };
    }
  });
}
