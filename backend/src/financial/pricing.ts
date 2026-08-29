/**
 * Pricing Engine — computes the customer-facing quote for a booking.
 *
 * The engine calls:
 *   1. Commission Engine → platform fee (also splits into office/marketer/host/owner)
 *   2. Tax Engine → VAT on the platform fee (rental amount itself is handled by tax rules)
 *
 * IT DOES NOT charge anything — see `payment.orchestrator.ts`.
 */

import { computeCommission, type TransactionType, type CommissionBreakdown } from './commission.js';
import { computeTax, type ServiceType, type TaxComputation } from './tax.js';
import { add } from '../money.js';
import { config } from '../config.js';

export interface QuoteInput {
  transactionType: TransactionType;
  propertyType?: string | null;
  /** The rental amount / listing price BEFORE platform fee. */
  grossAmountHalalahs: bigint;
  /** Optional: force a specific service type for tax (defaults are inferred). */
  rentalServiceType?: ServiceType;
  currency?: string;
  at?: Date;
}

export interface Quote {
  currency: string;
  transactionType: TransactionType;
  grossAmountHalalahs: bigint;         // paid to host/owner (before deductions)
  commission: CommissionBreakdown;
  taxOnPlatformFee: TaxComputation;
  taxOnRental: TaxComputation;         // usually 0 for residential
  customerTotalHalalahs: bigint;       // what the customer pays at checkout
  platformNetRevenueHalalahs: bigint;  // platform fee - office - marketer (VAT is a liability, not revenue)
}

export async function computeQuote(input: QuoteInput): Promise<Quote> {
  const currency = input.currency ?? config.DEFAULT_CURRENCY;

  // 1. Commission (splits gross among platform / host / owner / office / marketer)
  const commission = await computeCommission({
    transactionType: input.transactionType,
    propertyType: input.propertyType ?? null,
    grossAmountHalalahs: input.grossAmountHalalahs,
    currency,
    at: input.at,
  });

  // 2. Tax on the platform fee (services are taxable)
  const taxOnPlatformFee = await computeTax({
    serviceType: 'PLATFORM_FEE',
    taxableAmountHalalahs: commission.platformFeeHalalahs,
    transactionType: input.transactionType,
    at: input.at,
  });

  // 3. Tax on the rental amount itself (usually exempt for residential; taxable for commercial)
  const rentalService: ServiceType =
    input.rentalServiceType ??
    (input.transactionType === 'COMMERCIAL_RENTAL' ? 'RENTAL_COMMERCIAL' :
     input.transactionType === 'SALE'              ? 'SALE' :
                                                     'RENTAL_RESIDENTIAL');
  const taxOnRental = await computeTax({
    serviceType: rentalService,
    taxableAmountHalalahs: input.grossAmountHalalahs,
    transactionType: input.transactionType,
    at: input.at,
  });

  // Customer total = rental + platform fee + all applicable taxes
  const customerTotal = add(
    input.grossAmountHalalahs,
    commission.platformFeeHalalahs,
    taxOnPlatformFee.taxAmountHalalahs,
    taxOnRental.taxAmountHalalahs,
  );

  // Platform's NET revenue = platform fee minus what's shared out. VAT collected is a liability, NOT revenue.
  const platformNetRevenue = commission.platformFeeHalalahs
    - commission.officeShareHalalahs
    - commission.marketerShareHalalahs;

  return {
    currency,
    transactionType: input.transactionType,
    grossAmountHalalahs: input.grossAmountHalalahs,
    commission,
    taxOnPlatformFee,
    taxOnRental,
    customerTotalHalalahs: customerTotal,
    platformNetRevenueHalalahs: platformNetRevenue,
  };
}
