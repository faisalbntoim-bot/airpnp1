/**
 * Commission Engine.
 *
 * Rules live in the DB (CommissionRule), never in code. This service picks
 * the most specific active rule for a given transaction and computes shares.
 *
 * For DAILY_RENTAL:
 *   - hostAmount   = grossAmount (host receives the full rental value)
 *   - officeShare  = 0
 *   - marketerShare= 0
 *   - platformFee  = grossAmount * platformPercentage (clamped by min/max fee)
 *
 * For other transaction types (SALE, LONG_TERM_RENTAL, COMMERCIAL_RENTAL,
 * ADVERTISEMENT, SUBSCRIPTION, SERVICE), the rule can also carry
 * office/marketer percentages (percentage of platform fee, or of gross —
 * see `officePercentage` / `marketerPercentage` semantics below).
 */

import type { CommissionRule } from '@prisma/client';
import { getPrisma } from '../db.js';
import { applyPercent, clampFee, sub } from '../money.js';
import { config } from '../config.js';

export type TransactionType =
  | 'DAILY_RENTAL'
  | 'LONG_TERM_RENTAL'
  | 'COMMERCIAL_RENTAL'
  | 'SALE'
  | 'ADVERTISEMENT'
  | 'SUBSCRIPTION'
  | 'SERVICE';

export interface CommissionBreakdown {
  ruleId: string | null;
  grossAmountHalalahs: bigint;
  platformFeeHalalahs: bigint;
  officeShareHalalahs: bigint;
  marketerShareHalalahs: bigint;
  ownerAmountHalalahs: bigint;
  hostAmountHalalahs: bigint;
  currency: string;
}

export async function findRule(input: {
  transactionType: TransactionType;
  propertyType?: string | null;
  currency?: string;
  at?: Date;
}): Promise<CommissionRule | null> {
  const now = input.at ?? new Date();
  const rules = await getPrisma().commissionRule.findMany({
    where: {
      transactionType: input.transactionType,
      active: true,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      currency: input.currency ?? config.DEFAULT_CURRENCY,
    },
    orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }],
  });
  // most-specific propertyType match wins; otherwise the top-priority generic rule.
  const specific = rules.find((r) => r.propertyType != null && r.propertyType === input.propertyType);
  return specific ?? rules.find((r) => r.propertyType == null) ?? null;
}

export async function computeCommission(input: {
  transactionType: TransactionType;
  propertyType?: string | null;
  grossAmountHalalahs: bigint;
  currency?: string;
  at?: Date;
}): Promise<CommissionBreakdown> {
  const currency = input.currency ?? config.DEFAULT_CURRENCY;
  const rule = await findRule({
    transactionType: input.transactionType,
    propertyType: input.propertyType ?? null,
    currency,
    at: input.at,
  });

  // Defaults when no rule is set — Daily Rental uses env default; all others = 0 until a rule is created.
  const platformPercent = rule?.platformPercentage ??
    (input.transactionType === 'DAILY_RENTAL' ? config.DEFAULT_PLATFORM_FEE_PERCENT : 0);

  const rawPlatformFee = applyPercent(input.grossAmountHalalahs, platformPercent);
  const platformFee = clampFee(rawPlatformFee, rule?.minimumFeeHalalahs, rule?.maximumFeeHalalahs);

  // office/marketer shares are % of the PLATFORM FEE (never of the gross), so the host/owner amount is unaffected.
  const officeShare  = rule?.officePercentage  != null ? applyPercent(platformFee, rule.officePercentage)  : 0n;
  const marketerShare= rule?.marketerPercentage != null ? applyPercent(platformFee, rule.marketerPercentage): 0n;

  // For DAILY_RENTAL, host receives the full gross. For SALE/LONG_TERM the "hostAmount" is 0 and the owner gets it.
  const isDaily = input.transactionType === 'DAILY_RENTAL';
  const beneficiaryAmount = input.grossAmountHalalahs;   // paid to host or owner depending on type

  return {
    ruleId: rule?.id ?? null,
    grossAmountHalalahs: input.grossAmountHalalahs,
    platformFeeHalalahs: platformFee,
    officeShareHalalahs: isDaily ? 0n : officeShare,
    marketerShareHalalahs: isDaily ? 0n : marketerShare,
    ownerAmountHalalahs: isDaily ? 0n : beneficiaryAmount,
    hostAmountHalalahs:  isDaily ? beneficiaryAmount : 0n,
    currency,
  };
}
