import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';
import { resetDb, seedRules, shutdown, makeDailyRentalBooking } from './helpers.js';
import { startCheckout } from '../src/financial/payment.orchestrator.js';
import { createRefund } from '../src/financial/refund.js';
import { getPrisma } from '../src/db.js';
import { halalahsFromMajor } from '../src/money.js';
import { balance } from '../src/financial/ledger.js';
import webhookRoutes from '../src/routes/webhook.js';
import { _resetSandbox, simulateCapture, signWebhook } from '../src/providers/sandbox.js';
import { _setProvider } from '../src/providers/payment-provider.js';

beforeEach(async () => {
  _resetSandbox(); _setProvider(null);
  await resetDb(); await seedRules();
});
afterAll(async () => { await shutdown(); });

async function completedPayment(grossMajor: string) {
  const { booking, host } = await makeDailyRentalBooking({ grossMajor });
  const co = await startCheckout({ bookingId: booking.id, idempotencyKey: `idem-${Math.random()}` });
  const app = Fastify({ logger: false });
  await app.register(async (s) => { await s.register(webhookRoutes); });
  await app.ready();
  const evt = simulateCapture(co.providerPaymentId);
  const { body, signature } = signWebhook(evt);
  await app.inject({
    method: 'POST', url: '/v1/payments/webhook',
    headers: { 'content-type': 'application/json', 'x-sandbox-signature': signature },
    payload: body,
  });
  await app.close();
  return { co, host, bookingId: booking.id };
}

describe('refund — full', () => {
  it('reverses every ledger balance to zero and marks the payment refunded', async () => {
    const { co, host } = await completedPayment('300');
    const res = await createRefund({ paymentId: co.paymentId, idempotencyKey: 'ref-1' });
    expect(res.status).toBe('completed');
    expect(res.amountHalalahs).toBe(halalahsFromMajor('317.25'));

    const payment = await getPrisma().payment.findUnique({ where: { id: co.paymentId } });
    expect(payment?.status).toBe('refunded');
    expect((await balance(`HOST_PAYABLE:${host.id}`)).net).toBe(0n);
    expect((await balance('PSP_CLEARING')).net).toBe(0n);
    expect((await balance('PLATFORM_REVENUE')).net).toBe(0n);
    expect((await balance('VAT_PAYABLE')).net).toBe(0n);
  });
});

describe('refund — partial', () => {
  it('cannot exceed the remaining amount', async () => {
    const { co } = await completedPayment('300');
    await expect(
      createRefund({
        paymentId: co.paymentId, idempotencyKey: 'ref-x',
        amountHalalahs: halalahsFromMajor('1000'),
      }),
    ).rejects.toThrow(/exceeds/);
  });

  it('leaves the payment in partial_refunded state; a second refund can top it up', async () => {
    const { co } = await completedPayment('300');
    const first = await createRefund({
      paymentId: co.paymentId, idempotencyKey: 'ref-a',
      amountHalalahs: halalahsFromMajor('100'),
    });
    expect(first.status).toBe('completed');
    let payment = await getPrisma().payment.findUnique({ where: { id: co.paymentId } });
    expect(payment?.status).toBe('partial_refunded');
    // top up the remainder = 317.25 - 100 = 217.25
    const remain = halalahsFromMajor('217.25');
    const second = await createRefund({
      paymentId: co.paymentId, idempotencyKey: 'ref-b', amountHalalahs: remain,
    });
    expect(second.status).toBe('completed');
    payment = await getPrisma().payment.findUnique({ where: { id: co.paymentId } });
    expect(payment?.status).toBe('refunded');
  });
});

describe('refund — idempotency', () => {
  it('same idempotency key returns the memoised refund', async () => {
    const { co } = await completedPayment('300');
    const a = await createRefund({ paymentId: co.paymentId, idempotencyKey: 'ref-once', amountHalalahs: halalahsFromMajor('50') });
    const b = await createRefund({ paymentId: co.paymentId, idempotencyKey: 'ref-once', amountHalalahs: halalahsFromMajor('50') });
    expect(a.refundId).toBe(b.refundId);
  });
});
