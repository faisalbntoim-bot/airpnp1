/**
 * Tax Engine — VAT / GST.
 *
 * IMPORTANT: SakanHub does not assume 15% VAT on every amount.
 *   - Residential rent is generally EXEMPT under Saudi VAT rules
 *     (see ZATCA guidance) — but this is a CONFIGURABLE rule, not a hard-code.
 *   - Commercial rent is taxable.
 *   - Platform service fee, brokerage, advertisements and subscriptions
 *     are taxable services.
 *
 * All tax rules live in `TaxRule` and are editable by admins.
 */

import type { TaxRule } from '@prisma/client';
import { getPrisma } from '../db.js';
import { applyPercent } from '../money.js';
import { config } from '../config.js';

export type ServiceType =
  | 'RENTAL_RESIDENTIAL'
  | 'RENTAL_COMMERCIAL'
  | 'PLATFORM_FEE'
  | 'BROKERAGE'
  | 'ADVERTISEMENT'
  | 'SUBSCRIPTION'
  | 'SALE';

export type TaxStatus = 'applied' | 'exempt' | 'not_applicable';

export interface TaxComputation {
  ruleId: string | null;
  serviceType: ServiceType;
  taxableAmountHalalahs: bigint;
  ratePercent: number;
  taxAmountHalalahs: bigint;
  status: TaxStatus;
  reasonCode?: string;
}

async function findRule(serviceType: ServiceType, transactionType?: string, at: Date = new Date()): Promise<TaxRule | null> {
  const rules = await getPrisma().taxRule.findMany({
    where: {
      serviceType,
      active: true,
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
    },
    orderBy: [{ updatedAt: 'desc' }],
  });
  // Prefer a rule matching the transactionType exactly, then a generic one.
  return rules.find((r) => r.transactionType === transactionType) ?? rules.find((r) => r.transactionType == null) ?? null;
}

export async function computeTax(input: {
  serviceType: ServiceType;
  taxableAmountHalalahs: bigint;
  transactionType?: string;
  at?: Date;
}): Promise<TaxComputation> {
  const rule = await findRule(input.serviceType, input.transactionType, input.at);

  // No rule → fall back to default rate ONLY for services we know are taxable.
  if (!rule) {
    const defaultTaxable: ServiceType[] = ['PLATFORM_FEE', 'BROKERAGE', 'ADVERTISEMENT', 'SUBSCRIPTION', 'RENTAL_COMMERCIAL'];
    const isTaxable = defaultTaxable.includes(input.serviceType);
    const rate = isTaxable ? config.DEFAULT_TAX_RATE_PERCENT : 0;
    return {
      ruleId: null,
      serviceType: input.serviceType,
      taxableAmountHalalahs: input.taxableAmountHalalahs,
      ratePercent: rate,
      taxAmountHalalahs: isTaxable ? applyPercent(input.taxableAmountHalalahs, rate) : 0n,
      status: isTaxable ? 'applied' : input.serviceType === 'RENTAL_RESIDENTIAL' ? 'exempt' : 'not_applicable',
      reasonCode: isTaxable ? undefined : input.serviceType === 'RENTAL_RESIDENTIAL' ? 'SA_VAT_RESIDENTIAL_EXEMPT_DEFAULT' : undefined,
    };
  }

  if (!rule.taxable || rule.ratePercent === 0) {
    return {
      ruleId: rule.id,
      serviceType: input.serviceType,
      taxableAmountHalalahs: input.taxableAmountHalalahs,
      ratePercent: 0,
      taxAmountHalalahs: 0n,
      status: 'exempt',
      reasonCode: rule.reasonCode ?? undefined,
    };
  }

  return {
    ruleId: rule.id,
    serviceType: input.serviceType,
    taxableAmountHalalahs: input.taxableAmountHalalahs,
    ratePercent: rule.ratePercent,
    taxAmountHalalahs: applyPercent(input.taxableAmountHalalahs, rule.ratePercent),
    status: 'applied',
    reasonCode: rule.reasonCode ?? undefined,
  };
}
