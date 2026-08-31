import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';
import { resetDb, seedRules, shutdown, makeDailyRentalBooking } from './helpers.js';
import { startCheckout } from '../src/financial/payment.orchestrator.js';
import webhookRoutes from '../src/routes/webhook.js';
import { _resetSandbox, signWebhook } from '../src/providers/sandbox.js';
import { _setProvider } from '../src/providers/payment-provider.js';
import { getPrisma } from '../src/db.js';

beforeEach(async () => { _resetSandbox(); _setProvider(null); await resetDb(); await seedRules(); });
afterAll(async () => { await shutdown(); });

describe('webhook — amount + currency verification', () => {
  it('rejects a webhook whose amount does not match the payment row', async () => {
    const { booking } = await makeDailyRentalBooking({ grossMajor: '300' });
    const co = await startCheckout({ bookingId: booking.id, idempotencyKey: 'k-amt' });
    const app = Fastify({ logger: false });
    await app.register(async (s) => { await s.register(webhookRoutes); });
    await app.ready();

    // Craft a webhook with a wrong amount (1 SAR = 100 halalahs).
    const evt = {
      id: 'evt_amt_1',
      type: 'payment.captured' as const,
      providerPaymentId: co.providerPaymentId,
      orderRef: co.paymentId,
      status: 'captured',
      amountHalalahs: '100',
      currency: 'SAR',
    };
    const { body, signature } = signWebhook(evt);
    const res = await app.inject({
      method: 'POST', url: '/v1/payments/webhook',
      headers: { 'content-type': 'application/json', 'x-sandbox-signature': signature },
      payload: body,
    });
    // The webhook itself completes 500 (processing failed) — the important
    // guarantee is that the payment stays PENDING, not captured.
    expect(res.statusCode).toBe(500);
    const payment = await getPrisma().payment.findUnique({ where: { id: co.paymentId } });
    expect(payment?.status).toBe('pending');
    await app.close();
  });

  it('rejects a webhook whose currency does not match the payment row', async () => {
    const { booking } = await makeDailyRentalBooking({ grossMajor: '300' });
    const co = await startCheckout({ bookingId: booking.id, idempotencyKey: 'k-cur' });
    const app = Fastify({ logger: false });
    await app.register(async (s) => { await s.register(webhookRoutes); });
    await app.ready();

    const evt = {
      id: 'evt_cur_1',
      type: 'payment.captured' as const,
      providerPaymentId: co.providerPaymentId,
      orderRef: co.paymentId,
      status: 'captured',
      amountHalalahs: co.quote.customerTotalHalalahs.toString(),
      currency: 'USD',
    };
    const { body, signature } = signWebhook(evt);
    const res = await app.inject({
      method: 'POST', url: '/v1/payments/webhook',
      headers: { 'content-type': 'application/json', 'x-sandbox-signature': signature },
      payload: body,
    });
    expect(res.statusCode).toBe(500);
    const payment = await getPrisma().payment.findUnique({ where: { id: co.paymentId } });
    expect(payment?.status).toBe('pending');
    await app.close();
  });
});
