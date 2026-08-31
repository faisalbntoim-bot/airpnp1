import { describe, it, expect } from 'vitest';
import { halalahsFromMajor, majorFromHalalahs, applyPercent, divideWithRounding, formatSAR } from '../src/money.js';

describe('money — halalah conversion', () => {
  it('parses integer major units', () => {
    expect(halalahsFromMajor('300')).toBe(30_000n);
    expect(halalahsFromMajor(300)).toBe(30_000n);
    expect(halalahsFromMajor('1000000')).toBe(100_000_000n);
  });

  it('parses fractional major units to 2 decimals', () => {
    expect(halalahsFromMajor('300.50')).toBe(30_050n);
    expect(halalahsFromMajor('0.01')).toBe(1n);
    expect(halalahsFromMajor('0.1')).toBe(10n);
  });

  it('rejects >2 decimal places (never accept float ambiguity)', () => {
    expect(() => halalahsFromMajor('1.234')).toThrow();
  });

  it('round-trips through majorFromHalalahs', () => {
    for (const v of ['29.00', '40.00', '100.00', '300.00', '500.00', '1000.00', '5000.00', '100000.00', '1000000.00']) {
      const h = halalahsFromMajor(v);
      expect(majorFromHalalahs(h)).toBe(v);
    }
  });

  it('formatSAR appends currency', () => {
    expect(formatSAR(30_000n)).toBe('300.00 SAR');
  });
});

describe('money — applyPercent', () => {
  it('5% of 300 SAR = 15 SAR', () => {
    expect(applyPercent(halalahsFromMajor('300'), 5)).toBe(halalahsFromMajor('15'));
  });
  it('15% of 15 SAR = 2.25 SAR', () => {
    expect(applyPercent(halalahsFromMajor('15'), 15)).toBe(halalahsFromMajor('2.25'));
  });
  it('2.5% of 1,000,000 SAR = 25,000 SAR', () => {
    expect(applyPercent(halalahsFromMajor('1000000'), 2.5)).toBe(halalahsFromMajor('25000'));
  });
});

describe('money — rounding', () => {
  it('banker rounds 0.5 to even', () => {
    // 5/2 = 2.5 -> banker -> 2
    expect(divideWithRounding(5n, 2n)).toBe(2n);
    // 7/2 = 3.5 -> banker -> 4
    expect(divideWithRounding(7n, 2n)).toBe(4n);
  });
  it('never returns floats — result stays BigInt', () => {
    expect(typeof divideWithRounding(1_000n, 3n)).toBe('bigint');
  });
});
