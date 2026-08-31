import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';
import { resetDb, seedRules, shutdown, makeDailyRentalBooking } from './helpers.js';
import { startCheckout } from '../src/financial/payment.orchestrator.js';
import webhookRoutes from '../src/routes/webhook.js';
import { _resetSandbox, simulateCapture, signWebhook } from '../src/providers/sandbox.js';
import { _setProvider } from '../src/providers/payment-provider.js';
import { getPrisma } from '../src/db.js';

beforeEach(async () => {
  _resetSandbox(); _setProvider(null);
  await resetDb(); await seedRules();
});
afterAll(async () => { await shutdown(); });

async function server() {
  const app = Fastify({ logger: false });
  await app.register(async (s) => { await s.register(webhookRoutes); });
  await app.ready();
  return app;
}

describe('webhook — signature enforcement', () => {
  it('rejects a body with an invalid signature (400)', async () => {
    const app = await server();
    const res = await app.inject({
      method: 'POST', url: '/v1/payments/webhook',
      headers: { 'content-type': 'application/json', 'x-sandbox-signature': 'deadbeef' },
      payload: JSON.stringify({ id: 'x', type: 'payment.captured' }),
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('rejects a body with a wrong secret signature', async () => {
    const app = await server();
    const body = JSON.stringify({ id: 'x', type: 'payment.captured' });
    const crypto = await import('node:crypto');
    const wrong = crypto.createHmac('sha256', 'wrong-secret').update(body).digest('hex');
    const res = await app.inject({
      method: 'POST', url: '/v1/payments/webhook',
      headers: { 'content-type': 'application/json', 'x-sandbox-signature': wrong },
      payload: body,
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('accepts a body signed with the correct secret and records the event once', async () => {
    const { booking } = await makeDailyRentalBooking({ grossMajor: '300' });
    const co = await startCheckout({ bookingId: booking.id, idempotencyKey: 'idem-wh' });
    const app = await server();
    const evt = simulateCapture(co.providerPaymentId);
    const { body, signature } = signWebhook(evt);
    const first = await app.inject({
      method: 'POST', url: '/v1/payments/webhook',
      headers: { 'content-type': 'application/json', 'x-sandbox-signature': signature },
      payload: body,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().duplicate).toBeFalsy();

    const second = await app.inject({
      method: 'POST', url: '/v1/payments/webhook',
      headers: { 'content-type': 'application/json', 'x-sandbox-signature': signature },
      payload: body,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().duplicate).toBe(true);
    await app.close();

    const evts = await getPrisma().webhookEvent.findMany({ where: { externalEventId: evt.id } });
    expect(evts.length).toBe(1);
    expect(evts[0]!.processed).toBe(true);
  });
});
