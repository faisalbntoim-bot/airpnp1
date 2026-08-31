import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';
import { resetDb, seedRules, shutdown, makeDailyRentalBooking } from './helpers.js';
import { startCheckout } from '../src/financial/payment.orchestrator.js';
import { wallet } from '../src/financial/reporting.js';
import { getPrisma } from '../src/db.js';
import webhookRoutes from '../src/routes/webhook.js';
import { _resetSandbox, simulateCapture, signWebhook } from '../src/providers/sandbox.js';
import { _setProvider } from '../src/providers/payment-provider.js';

beforeEach(async () => { _resetSandbox(); _setProvider(null); await resetDb(); await seedRules(); });
afterAll(async () => { await shutdown(); });

async function captureOne(gross: string) {
  const { booking, host } = await makeDailyRentalBooking({ grossMajor: gross });
  const co = await startCheckout({ bookingId: booking.id, idempotencyKey: `k-${gross}-${Math.random()}` });
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
  return { host, paymentId: co.paymentId };
}

describe('wallet — derived balances', () => {
  it('reports zero everything for a user with no activity', async () => {
    const prisma = getPrisma();
    const u = await prisma.user.create({ data: { phone: '+9660009', nameAr: 'فارغ' } });
    const w = await wallet(u.id);
    expect(w.availableHalalahs).toBe('0');
    expect(w.pendingHalalahs).toBe('0');
    expect(w.paidHalalahs).toBe('0');
    expect(w.totalEarningsHalalahs).toBe('0');
  });

  it('surfaces the host payable amount as part of total earnings', async () => {
    const { host } = await captureOne('300');
    const w = await wallet(host.id);
    expect(w.ledger.hostPayable).toBe('30000');           // 300 SAR
    expect(BigInt(w.totalEarningsHalalahs)).toBeGreaterThanOrEqual(30000n);
  });

  it('classifies eligible/paid/pending buckets from settlement status', async () => {
    const { host, paymentId } = await captureOne('300');
    const prisma = getPrisma();
    const b = await prisma.beneficiary.create({
      data: { userId: host.id, provider: 'sandbox', payoutEnabled: true },
    });
    await prisma.settlement.create({ data: { paymentId, beneficiaryId: b.id, amountHalalahs: 10000n, currency: 'SAR', status: 'ELIGIBLE' } });
    await prisma.settlement.create({ data: { paymentId, beneficiaryId: b.id, amountHalalahs: 5000n,  currency: 'SAR', status: 'PENDING' } });
    await prisma.settlement.create({ data: { paymentId, beneficiaryId: b.id, amountHalalahs: 15000n, currency: 'SAR', status: 'PAID' } });

    const w = await wallet(host.id);
    expect(w.availableHalalahs).toBe('10000');
    expect(w.pendingHalalahs).toBe('5000');
    expect(w.paidHalalahs).toBe('15000');
  });
});
