import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDb, seedRules, shutdown } from './helpers.js';
import { computeCommission } from '../src/financial/commission.js';
import { halalahsFromMajor } from '../src/money.js';

beforeEach(async () => { await resetDb(); await seedRules(); });
afterAll(async () => { await shutdown(); });

describe('commission — DAILY_RENTAL', () => {
  it('host receives the full gross; platform fee = 5% of gross; office/marketer = 0', async () => {
    const c = await computeCommission({
      transactionType: 'DAILY_RENTAL',
      grossAmountHalalahs: halalahsFromMajor('300'),
    });
    expect(c.hostAmountHalalahs).toBe(halalahsFromMajor('300'));
    expect(c.ownerAmountHalalahs).toBe(0n);
    expect(c.platformFeeHalalahs).toBe(halalahsFromMajor('15'));
    expect(c.officeShareHalalahs).toBe(0n);
    expect(c.marketerShareHalalahs).toBe(0n);
  });

  it('handles the spec test-case amounts (29/40/100/300/500/1000/5000/100000/1000000 SAR)', async () => {
    for (const [gross, fee] of [
      ['29',      '1.45'],
      ['40',      '2.00'],
      ['100',     '5.00'],
      ['300',     '15.00'],
      ['500',     '25.00'],
      ['1000',    '50.00'],
      ['5000',    '250.00'],
      ['100000',  '5000.00'],
      ['1000000', '50000.00'],
    ] as const) {
      const c = await computeCommission({
        transactionType: 'DAILY_RENTAL',
        grossAmountHalalahs: halalahsFromMajor(gross),
      });
      expect(c.hostAmountHalalahs).toBe(halalahsFromMajor(gross));
      expect(c.platformFeeHalalahs).toBe(halalahsFromMajor(fee));
    }
  });
});

describe('commission — SALE', () => {
  it('owner gets the full gross; office and marketer get % of the PLATFORM FEE (not gross)', async () => {
    const gross = halalahsFromMajor('1000000');   // 1,000,000 SAR sale
    const c = await computeCommission({
      transactionType: 'SALE',
      grossAmountHalalahs: gross,
    });
    // 2.5% platform fee = 25,000 SAR
    expect(c.platformFeeHalalahs).toBe(halalahsFromMajor('25000'));
    expect(c.ownerAmountHalalahs).toBe(gross);
    expect(c.hostAmountHalalahs).toBe(0n);
    // 40% of platform fee = 10,000 SAR office
    expect(c.officeShareHalalahs).toBe(halalahsFromMajor('10000'));
    // 10% of platform fee = 2,500 SAR marketer
    expect(c.marketerShareHalalahs).toBe(halalahsFromMajor('2500'));
  });
});

describe('commission — no rule fallback', () => {
  it('DAILY_RENTAL without any rule uses env DEFAULT_PLATFORM_FEE_PERCENT (5)', async () => {
    const { getPrisma } = await import('../src/db.js');
    await getPrisma().commissionRule.deleteMany({});
    const c = await computeCommission({
      transactionType: 'DAILY_RENTAL',
      grossAmountHalalahs: halalahsFromMajor('300'),
    });
    expect(c.platformFeeHalalahs).toBe(halalahsFromMajor('15'));
  });

  it('other transaction types default to 0% (must be configured explicitly)', async () => {
    const { getPrisma } = await import('../src/db.js');
    await getPrisma().commissionRule.deleteMany({});
    const c = await computeCommission({
      transactionType: 'SALE',
      grossAmountHalalahs: halalahsFromMajor('100000'),
    });
    expect(c.platformFeeHalalahs).toBe(0n);
  });
});
