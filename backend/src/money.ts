/**
 * Money helpers — SakanHub Financial Engine.
 *
 * All monetary values in the DB are stored as BigInt HALALAHS
 * (integer minor units of SAR). NEVER use JavaScript floats to
 * represent money in this codebase.
 *
 * - 1 SAR = 100 halalahs
 * - Multiply BEFORE dividing when possible.
 * - Percentages are represented as `number` in the 0..100 range.
 * - Rounding is configurable via `MONEY_ROUNDING` (banker | half-up | half-down).
 */

import { config } from './config.js';

export type Halalahs = bigint;

const MINOR_UNITS_PER_MAJOR = 100n;
const PERCENT_SCALE = 10_000n; // 4-decimal precision on percentages internally

// ---------------- Parsing / formatting ----------------

export function halalahsFromMajor(major: number | string): Halalahs {
  // Accepts "300", "300.50", 300, 300.5.
  const s = typeof major === 'number' ? major.toFixed(2) : String(major).trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) {
    throw new Error(`Invalid money value: ${major}`);
  }
  const [wholeRaw, fracRaw = ''] = s.split('.');
  const whole = wholeRaw ?? '0';
  const negative = whole.startsWith('-');
  const wholeAbs = negative ? whole.slice(1) : whole;
  const frac = (fracRaw + '00').slice(0, 2);
  const magnitude = BigInt(wholeAbs) * MINOR_UNITS_PER_MAJOR + BigInt(frac);
  return negative ? -magnitude : magnitude;
}

export function majorFromHalalahs(h: Halalahs): string {
  const negative = h < 0n;
  const abs = negative ? -h : h;
  const whole = abs / MINOR_UNITS_PER_MAJOR;
  const frac = abs % MINOR_UNITS_PER_MAJOR;
  return `${negative ? '-' : ''}${whole}.${frac.toString().padStart(2, '0')}`;
}

export function formatSAR(h: Halalahs): string {
  return `${majorFromHalalahs(h)} SAR`;
}

// ---------------- Arithmetic ----------------

export function add(...values: Halalahs[]): Halalahs {
  return values.reduce((a, b) => a + b, 0n);
}
export function sub(a: Halalahs, b: Halalahs): Halalahs { return a - b; }

/** Multiply halalahs by a fraction `numerator/denominator` (both integers). */
export function mulFraction(h: Halalahs, numerator: bigint, denominator: bigint): Halalahs {
  if (denominator === 0n) throw new Error('divide by zero');
  const product = h * numerator;
  return divideWithRounding(product, denominator);
}

/** Apply a percent (e.g. 5 for 5%). Uses banker/half-up per config. */
export function applyPercent(h: Halalahs, percent: number): Halalahs {
  if (!Number.isFinite(percent)) throw new Error('percent must be finite');
  // Convert 5.25% → 525 out of 10000
  const scaled = BigInt(Math.round(percent * 100)); // supports 2 decimals of %
  return mulFraction(h, scaled, PERCENT_SCALE);
}

/** Clamp with optional minimum/maximum fees (halalahs). */
export function clampFee(h: Halalahs, min?: Halalahs | null, max?: Halalahs | null): Halalahs {
  let out = h;
  if (min != null && out < min) out = min;
  if (max != null && out > max) out = max;
  return out;
}

// ---------------- Rounding ----------------

/**
 * Integer division with the configured rounding mode.
 * All monetary rounding must go through this to guarantee consistency.
 */
export function divideWithRounding(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new Error('divide by zero');
  const negative = (numerator < 0n) !== (denominator < 0n);
  const absN = numerator < 0n ? -numerator : numerator;
  const absD = denominator < 0n ? -denominator : denominator;
  const q = absN / absD;
  const r = absN % absD;
  if (r === 0n) return negative ? -q : q;

  const doubleR = r * 2n;
  let rounded = q;
  const mode = config.MONEY_ROUNDING;

  if (mode === 'half-up') {
    if (doubleR >= absD) rounded = q + 1n;
  } else if (mode === 'half-down') {
    if (doubleR > absD) rounded = q + 1n;
  } else {
    // banker's rounding (half to even)
    if (doubleR > absD) rounded = q + 1n;
    else if (doubleR === absD) rounded = (q % 2n === 0n) ? q : q + 1n;
  }
  return negative ? -rounded : rounded;
}

// ---------------- BigInt <-> JSON safety ----------------

/** Convert a value tree so BigInts serialize as strings (JSON-safe). */
export function jsonSafe<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value, (_k, v) => typeof v === 'bigint' ? v.toString() : v));
}
