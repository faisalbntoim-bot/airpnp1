/**
 * End-to-end payment flow through the sandbox provider.
 *
 * Booking → startCheckout → simulated webhook → capturePayment → ledger + invoice.
 * Also verifies webhook signature + dedup and the full range of spec test amounts.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';
import { resetDb, seedRules, shutdown, makeDailyRentalBooking } from './helpers.js';
import { startCheckout } from '../src/financial/payment.orchestrator.js';
import { getPrisma } from '../src/db.js';
import { halalahsFromMajor, jsonSafe } from '../src/money.js';
import { balance } from '../src/financial/ledger.js';
import webhookRoutes from '../src/routes/webhook.js';
import { _resetSandbox, simulateCapture, signWebhook } from '../src/providers/sandbox.js';
import { _setProvider } from '../src/providers/payment-provider.js';

async function buildTestServer() {
  const app = Fastify({ logger: false });
  await app.register(async (scope) => { await scope.register(webhookRoutes); });
  await app.ready();
  return app;
}

beforeEach(async () => {
  _resetSandbox();
  _setProvider(null);
  await resetDb();
  await seedRules();
});
afterAll(async () => { await shutdown(); });

const SPEC_AMOUNTS: Array<[string, string]> = [
  ['29',      '30.67'],
  ['40',      '42.30'],
  ['100',     '105.75'],
  ['300',     '317.25'],
  ['500',     '528.75'],
  ['1000',    '1057.50'],
  ['5000',    '5287.50'],
  ['100000',  '105750.00'],
  ['1000000', '1057500.00'],
];

describe('payment flow (sandbox) — spec amounts', () => {
  it.each(SPEC_AMOUNTS)('daily rental %s SAR → customer pays %s SAR', async (grossMajor, expectedTotalMajor) => {
    const { booking, host } = await makeDailyRentalBooking({ grossMajor });
    const co = await startCheckout({
      bookingId: booking.id,
      idempotencyKey: `idem-${grossMajor}`,
    });
    expect(co.quote.customerTotalHalalahs).toBe(halalahsFromMajor(expectedTotalMajor));

    const app = await buildTestServer();
    const evt = simulateCapture(co.providerPaymentId);
    const { body, signature } = signWebhook(evt);
    const res = await app.inject({
      method: 'POST', url: '/v1/payments/webhook',
      headers: { 'content-type': 'application/json', 'x-sandbox-signature': signature },
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    await app.close();

    const payment = await getPrisma().payment.findUnique({ where: { id: co.paymentId } });
    expect(payment?.status).toBe('captured');

    // Host receives the full gross.
    expect((await balance(`HOST_PAYABLE:${host.id}`)).net).toBe(halalahsFromMajor(grossMajor));
    // PSP clearing = customer total.
    expect((await balance('PSP_CLEARING')).net).toBe(halalahsFromMajor(expectedTotalMajor));
    // Invoice was issued.
    const inv = await getPrisma().invoice.findUnique({ where: { paymentId: co.paymentId } });
    expect(inv?.invoiceNumber).toMatch(/^SKN-\d{4}-\d{6}$/);
  });
});

describe('payment flow — idempotency', () => {
  it('startCheckout with the same idempotency key returns the same payment', async () => {
    const { booking } = await makeDailyRentalBooking({ grossMajor: '300' });
    const a = await startCheckout({ bookingId: booking.id, idempotencyKey: 'idem-same' });
    const b = await startCheckout({ bookingId: booking.id, idempotencyKey: 'idem-same' });
    expect(a.paymentId).toBe(b.paymentId);
    expect(jsonSafe(a)).toEqual(jsonSafe(b));
  });

  it('webhook received twice only captures once (dedup by external event id)', async () => {
    const { booking, host } = await makeDailyRentalBooking({ grossMajor: '300' });
    const co = await startCheckout({ bookingId: booking.id, idempotencyKey: 'idem-dup' });
    const app = await buildTestServer();
    const evt = simulateCapture(co.providerPaymentId);
    const { body, signature } = signWebhook(evt);

    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: 'POST', url: '/v1/payments/webhook',
        headers: { 'content-type': 'application/json', 'x-sandbox-signature': signature },
        payload: body,
      });
      expect(res.statusCode).toBe(200);
    }
    await app.close();

    // Only one capture-worth of ledger entries: host payable = 300 SAR (not 900).
    expect((await balance(`HOST_PAYABLE:${host.id}`)).net).toBe(halalahsFromMajor('300'));
  });
});
