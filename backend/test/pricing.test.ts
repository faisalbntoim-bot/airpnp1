import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDb, seedRules, shutdown } from './helpers.js';
import { computeQuote } from '../src/financial/pricing.js';
import { halalahsFromMajor } from '../src/money.js';

beforeEach(async () => { await resetDb(); await seedRules(); });
afterAll(async () => { await shutdown(); });

describe('pricing — Daily Rental Golden Rule (spec)', () => {
  // "300 SAR rent → platform fee 15 SAR → VAT on fee 2.25 SAR → customer pays 317.25 SAR → host receives 300 SAR"
  it('300 SAR flow matches the spec exactly', async () => {
    const q = await computeQuote({
      transactionType: 'DAILY_RENTAL',
      propertyType: 'apartment',
      grossAmountHalalahs: halalahsFromMajor('300'),
    });
    expect(q.grossAmountHalalahs).toBe(halalahsFromMajor('300'));
    expect(q.commission.platformFeeHalalahs).toBe(halalahsFromMajor('15'));
    expect(q.taxOnPlatformFee.taxAmountHalalahs).toBe(halalahsFromMajor('2.25'));
    expect(q.taxOnRental.status).toBe('exempt');
    expect(q.taxOnRental.taxAmountHalalahs).toBe(0n);
    expect(q.customerTotalHalalahs).toBe(halalahsFromMajor('317.25'));
    expect(q.commission.hostAmountHalalahs).toBe(halalahsFromMajor('300'));
    // Platform NET revenue for daily = platformFee (no office/marketer)
    expect(q.platformNetRevenueHalalahs).toBe(halalahsFromMajor('15'));
  });

  it('covers all spec test cases', async () => {
    // [gross, expectedFee, expectedVatOnFee, expectedCustomerTotal]
    const cases: Array<[string, string, string, string]> = [
      ['29',      '1.45',     '0.22', '30.67'],       // 29 + 1.45 + 0.2175 → banker rounds to 0.22
      ['40',      '2.00',     '0.30', '42.30'],
      ['100',     '5.00',     '0.75', '105.75'],
      ['300',     '15.00',    '2.25', '317.25'],
      ['500',     '25.00',    '3.75', '528.75'],
      ['1000',    '50.00',    '7.50', '1057.50'],
      ['5000',    '250.00',  '37.50', '5287.50'],
      ['100000',  '5000.00', '750.00','105750.00'],
      ['1000000', '50000.00','7500.00','1057500.00'],
    ];
    for (const [gross, fee, vat, total] of cases) {
      const q = await computeQuote({
        transactionType: 'DAILY_RENTAL',
        propertyType: 'apartment',
        grossAmountHalalahs: halalahsFromMajor(gross),
      });
      expect(q.commission.platformFeeHalalahs, `fee for ${gross}`).toBe(halalahsFromMajor(fee));
      expect(q.taxOnPlatformFee.taxAmountHalalahs, `vat for ${gross}`).toBe(halalahsFromMajor(vat));
      expect(q.customerTotalHalalahs, `total for ${gross}`).toBe(halalahsFromMajor(total));
      // Host always keeps the full gross under the DAILY rule
      expect(q.commission.hostAmountHalalahs).toBe(halalahsFromMajor(gross));
    }
  });
});

describe('pricing — commercial rental applies VAT on rental itself', () => {
  it('1000 SAR commercial → platform fee 3% + VAT on both rental and fee', async () => {
    const q = await computeQuote({
      transactionType: 'COMMERCIAL_RENTAL',
      propertyType: 'shop',
      grossAmountHalalahs: halalahsFromMajor('1000'),
    });
    expect(q.commission.platformFeeHalalahs).toBe(halalahsFromMajor('30'));
    expect(q.taxOnRental.status).toBe('applied');
    expect(q.taxOnRental.taxAmountHalalahs).toBe(halalahsFromMajor('150'));
    expect(q.taxOnPlatformFee.taxAmountHalalahs).toBe(halalahsFromMajor('4.50'));
    // total = 1000 + 30 + 150 + 4.50 = 1184.50
    expect(q.customerTotalHalalahs).toBe(halalahsFromMajor('1184.50'));
  });
});
