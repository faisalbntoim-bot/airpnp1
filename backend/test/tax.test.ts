import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDb, seedRules, shutdown } from './helpers.js';
import { computeTax } from '../src/financial/tax.js';
import { halalahsFromMajor } from '../src/money.js';

beforeEach(async () => { await resetDb(); await seedRules(); });
afterAll(async () => { await shutdown(); });

describe('tax — Saudi VAT rules', () => {
  it('residential rent is EXEMPT (never treated as revenue trigger)', async () => {
    const t = await computeTax({ serviceType: 'RENTAL_RESIDENTIAL', taxableAmountHalalahs: halalahsFromMajor('300') });
    expect(t.status).toBe('exempt');
    expect(t.taxAmountHalalahs).toBe(0n);
    expect(t.ratePercent).toBe(0);
    expect(t.reasonCode).toBe('SA_VAT_RESIDENTIAL_EXEMPT');
  });

  it('commercial rent is taxable at 15% (rule-driven)', async () => {
    const t = await computeTax({ serviceType: 'RENTAL_COMMERCIAL', taxableAmountHalalahs: halalahsFromMajor('1000') });
    expect(t.status).toBe('applied');
    expect(t.ratePercent).toBe(15);
    expect(t.taxAmountHalalahs).toBe(halalahsFromMajor('150'));
  });

  it('platform fee VAT is 15% on the fee amount only', async () => {
    const t = await computeTax({ serviceType: 'PLATFORM_FEE', taxableAmountHalalahs: halalahsFromMajor('15') });
    expect(t.status).toBe('applied');
    expect(t.taxAmountHalalahs).toBe(halalahsFromMajor('2.25'));
  });

  it('with no rule, residential falls back to exempt (default policy)', async () => {
    // clear rules
    const { getPrisma } = await import('../src/db.js');
    await getPrisma().taxRule.deleteMany({});
    const t = await computeTax({ serviceType: 'RENTAL_RESIDENTIAL', taxableAmountHalalahs: halalahsFromMajor('300') });
    expect(t.status).toBe('exempt');
    expect(t.taxAmountHalalahs).toBe(0n);
  });

  it('with no rule, PLATFORM_FEE falls back to configured default rate (still taxable)', async () => {
    const { getPrisma } = await import('../src/db.js');
    await getPrisma().taxRule.deleteMany({});
    const t = await computeTax({ serviceType: 'PLATFORM_FEE', taxableAmountHalalahs: halalahsFromMajor('100') });
    expect(t.status).toBe('applied');
    expect(t.taxAmountHalalahs).toBe(halalahsFromMajor('15'));
  });
});
