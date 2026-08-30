import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDb, shutdown } from './helpers.js';
import { runSettlementRetrySweep, nextEligibleAt } from '../src/workers/settlement-retry.js';
import { getPrisma } from '../src/db.js';
import { halalahsFromMajor } from '../src/money.js';
import { _resetSandbox } from '../src/providers/sandbox.js';
import { _setProvider } from '../src/providers/payment-provider.js';

async function seedFailedSettlement(opts: {
  retryCount: number;
  lastRetryAt: Date | null;
  kycOk?: boolean;
  payoutEnabled?: boolean;
}) {
  const prisma = getPrisma();
  const suffix = Math.random().toString(36).slice(2, 8);
  const user = await prisma.user.create({ data: { phone: `+9660810${suffix}`.slice(0, 13), nameAr: 'م' } });
  if (opts.kycOk) {
    await prisma.kyc.create({ data: { userId: user.id, level: 'FULL', status: 'approved' } });
  }
  const b = await prisma.beneficiary.create({
    data: { userId: user.id, provider: 'sandbox', payoutEnabled: opts.payoutEnabled ?? true, externalBeneficiaryId: `sb_ben_${suffix}` },
  });
  const property = await prisma.property.create({
    data: { listingNumber: `L-${suffix}`, ownerId: user.id, category: 'apartment', purpose: 'daily' },
  });
  const cust = await prisma.user.create({ data: { phone: `+9660820${suffix}`.slice(0, 13), nameAr: 'ع' } });
  const booking = await prisma.booking.create({
    data: {
      propertyId: property.id, customerId: cust.id, hostId: user.id,
      transactionType: 'DAILY_RENTAL', grossAmountHalalahs: halalahsFromMajor('300'),
      currency: 'SAR', status: 'confirmed',
    },
  });
  const payment = await prisma.payment.create({
    data: {
      bookingId: booking.id, type: 'CHARGE', grossAmountHalalahs: halalahsFromMajor('317.25'),
      currency: 'SAR', status: 'captured', provider: 'sandbox',
      idempotencyKey: `k-${suffix}`,
    },
  });
  return prisma.settlement.create({
    data: {
      paymentId: payment.id, beneficiaryId: b.id, amountHalalahs: halalahsFromMajor('300'),
      currency: 'SAR', status: 'FAILED',
      retryCount: opts.retryCount, lastRetryAt: opts.lastRetryAt,
      failureReason: 'test seed',
    },
  });
}

beforeEach(async () => { _resetSandbox(); _setProvider(null); await resetDb(); });
afterAll(async () => { await shutdown(); });

describe('settlement-retry — backoff math', () => {
  it('exponential base 5m: 5, 10, 20, 40, 80 minutes', () => {
    const t0 = new Date('2026-01-01T00:00:00Z');
    expect(nextEligibleAt(t0, 0).getTime() - t0.getTime()).toBe(5 * 60_000);
    expect(nextEligibleAt(t0, 1).getTime() - t0.getTime()).toBe(10 * 60_000);
    expect(nextEligibleAt(t0, 2).getTime() - t0.getTime()).toBe(20 * 60_000);
    expect(nextEligibleAt(t0, 3).getTime() - t0.getTime()).toBe(40 * 60_000);
  });
});

describe('settlement-retry — sweeps', () => {
  it('retries a FAILED settlement that has passed its backoff and pays out', async () => {
    const s = await seedFailedSettlement({
      retryCount: 0,
      lastRetryAt: new Date(Date.now() - 60 * 60 * 1000),  // 60 min ago — well past 5 min backoff
      kycOk: true,
    });
    const r = await runSettlementRetrySweep();
    expect(r.retried).toContain(s.id);
    expect(r.paid).toContain(s.id);
    const after = await getPrisma().settlement.findUnique({ where: { id: s.id } });
    expect(after?.status).toBe('PAID');
  });

  it('leaves a settlement whose backoff has not elapsed alone', async () => {
    const s = await seedFailedSettlement({
      retryCount: 3,     // 5 * 2^3 = 40 min backoff
      lastRetryAt: new Date(Date.now() - 2 * 60 * 1000),   // only 2 min ago
      kycOk: true,
    });
    const r = await runSettlementRetrySweep();
    expect(r.retried).not.toContain(s.id);
  });

  it('skips a settlement that has reached MAX_RETRIES', async () => {
    const s = await seedFailedSettlement({
      retryCount: 5,
      lastRetryAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      kycOk: true,
    });
    const r = await runSettlementRetrySweep({ maxRetries: 5 });
    expect(r.skipped).toContain(s.id);
    expect(r.retried).not.toContain(s.id);
  });

  it('never re-pays a PAID settlement (idempotency across two sweeps)', async () => {
    const s = await seedFailedSettlement({
      retryCount: 0,
      lastRetryAt: new Date(Date.now() - 60 * 60 * 1000),
      kycOk: true,
    });
    const first = await runSettlementRetrySweep();
    expect(first.paid).toContain(s.id);
    const second = await runSettlementRetrySweep();
    expect(second.retried).not.toContain(s.id);      // now PAID — never picked up again
    const after = await getPrisma().settlement.findUnique({ where: { id: s.id } });
    expect(after?.status).toBe('PAID');
  });

  it('re-fails when the beneficiary is still not eligible; increments retryCount', async () => {
    const s = await seedFailedSettlement({
      retryCount: 0,
      lastRetryAt: new Date(Date.now() - 60 * 60 * 1000),
      kycOk: false,           // KYC not approved → payout refuses
      payoutEnabled: false,
    });
    const r = await runSettlementRetrySweep();
    expect(r.failed).toContain(s.id);
    const after = await getPrisma().settlement.findUnique({ where: { id: s.id } });
    expect(after?.status).toBe('FAILED');
    expect(after?.retryCount).toBe(1);              // incremented
  });
});
