import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';
import { resetDb, seedRules, shutdown, makeDailyRentalBooking } from './helpers.js';
import { startCheckout } from '../src/financial/payment.orchestrator.js';
import { requestPayout } from '../src/financial/payout.js';
import { markEligible } from '../src/financial/settlement.js';
import { getPrisma } from '../src/db.js';
import webhookRoutes from '../src/routes/webhook.js';
import { _resetSandbox, simulateCapture, signWebhook } from '../src/providers/sandbox.js';
import { _setProvider } from '../src/providers/payment-provider.js';

beforeEach(async () => { _resetSandbox(); _setProvider(null); await resetDb(); await seedRules(); });
afterAll(async () => { await shutdown(); });

async function primeCapturedBooking() {
  const { booking, host } = await makeDailyRentalBooking({ grossMajor: '300' });
  const co = await startCheckout({ bookingId: booking.id, idempotencyKey: `k-${Math.random()}` });
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
  return { co, host };
}

describe('payout — gating', () => {
  it('refuses without a beneficiary row', async () => {
    const { co } = await primeCapturedBooking();
    const settlements = await getPrisma().settlement.findMany({ where: { paymentId: co.paymentId } });
    expect(settlements.length).toBe(0); // no beneficiary was set up before capture, so nothing was created
  });

  it('refuses payout without KYC/FULL approved and payoutEnabled', async () => {
    const { host } = await primeCapturedBooking();
    const prisma = getPrisma();
    // Set up beneficiary but leave KYC unset.
    const b = await prisma.beneficiary.create({
      data: { userId: host.id, provider: 'sandbox', payoutEnabled: false },
    });
    const s = await prisma.settlement.create({
      data: {
        paymentId: (await prisma.payment.findFirst({ where: { bookingId: (await prisma.booking.findFirst({ where: { hostId: host.id } }))!.id } }))!.id,
        beneficiaryId: b.id, amountHalalahs: 30000n, currency: 'SAR', status: 'PENDING',
      },
    });
    await expect(markEligible(s.id)).rejects.toThrow(/not eligible/);
    await expect(requestPayout({ settlementId: s.id })).rejects.toThrow(/ELIGIBLE/);
  });

  it('allows payout once KYC=FULL/approved and payoutEnabled=true', async () => {
    const { host } = await primeCapturedBooking();
    const prisma = getPrisma();
    await prisma.kyc.create({ data: { userId: host.id, level: 'FULL', status: 'approved' } });
    const b = await prisma.beneficiary.create({
      data: {
        userId: host.id, provider: 'sandbox', payoutEnabled: true,
        externalBeneficiaryId: 'sb_ben_test',
      },
    });
    const payment = (await prisma.payment.findFirst({ where: { bookingId: (await prisma.booking.findFirst({ where: { hostId: host.id } }))!.id } }))!;
    const s = await prisma.settlement.create({
      data: {
        paymentId: payment.id, beneficiaryId: b.id,
        amountHalalahs: 30000n, currency: 'SAR', status: 'PENDING',
      },
    });
    await markEligible(s.id);
    const res = await requestPayout({ settlementId: s.id });
    expect(res.status).toBe('PAID');
    expect(res.providerReference).toMatch(/^sb_out_/);

    // Second call on an already-PAID settlement is refused (no double transfer).
    await expect(requestPayout({ settlementId: s.id })).rejects.toThrow(/already paid/);
  });
});
