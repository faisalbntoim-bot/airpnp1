/**
 * Double-entry ledger.
 *
 * Every transaction produces a set of entries whose debits equal credits
 * (per currency, per transactionRef). Entries are IMMUTABLE — to reverse
 * a transaction, insert offsetting entries with a new transactionRef.
 *
 * Standard chart of accounts used by the engine (auto-created lazily):
 *   PSP_CLEARING            asset       — cash held by the PSP for us before payout
 *   HOST_PAYABLE:<userId>   liability   — money we owe a specific host
 *   OWNER_PAYABLE:<userId>  liability   — money we owe an owner (sale / long-term)
 *   OFFICE_PAYABLE:<id>     liability   — money we owe an office
 *   MARKETER_PAYABLE:<id>   liability   — money we owe a marketer
 *   PLATFORM_REVENUE        revenue     — our net service revenue (VAT-excluded)
 *   VAT_PAYABLE             liability   — VAT collected on our behalf
 *   PAYMENT_GATEWAY_FEE     expense     — what the PSP charged us
 *   REFUND_CLEARING         asset       — outbound refund in flight
 */

import type { Prisma } from '@prisma/client';
import { getPrisma } from '../db.js';
import type { Quote } from './pricing.js';
import { config } from '../config.js';

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export async function ensureAccount(code: string, opts: {
  name: string; type: AccountType; ownerUserId?: string; currency?: string;
}): Promise<string> {
  const prisma = getPrisma();
  const existing = await prisma.account.findUnique({ where: { code } });
  if (existing) return existing.id;
  const created = await prisma.account.create({
    data: {
      code,
      name: opts.name,
      type: opts.type,
      ownerUserId: opts.ownerUserId ?? null,
      currency: opts.currency ?? config.DEFAULT_CURRENCY,
    },
  });
  return created.id;
}

export interface Entry {
  accountId: string;
  debitHalalahs?: bigint;
  creditHalalahs?: bigint;
  description?: string;
}

/**
 * Persist a balanced set of ledger entries inside a single transaction.
 * Throws if debits ≠ credits per currency.
 */
export async function postEntries(args: {
  transactionRef: string;
  paymentId?: string;
  bookingId?: string;
  refundId?: string;
  currency?: string;
  entries: Entry[];
}): Promise<void> {
  const prisma = getPrisma();
  const currency = args.currency ?? config.DEFAULT_CURRENCY;

  let totalDebit = 0n, totalCredit = 0n;
  for (const e of args.entries) {
    totalDebit  += e.debitHalalahs  ?? 0n;
    totalCredit += e.creditHalalahs ?? 0n;
  }
  if (totalDebit !== totalCredit) {
    throw new Error(`ledger not balanced: debit=${totalDebit} credit=${totalCredit}`);
  }

  const rows: Prisma.LedgerEntryCreateManyInput[] = args.entries.map((e) => ({
    transactionRef: args.transactionRef,
    accountId: e.accountId,
    debitHalalahs:  e.debitHalalahs  ?? 0n,
    creditHalalahs: e.creditHalalahs ?? 0n,
    currency,
    paymentId: args.paymentId ?? null,
    bookingId: args.bookingId ?? null,
    refundId:  args.refundId  ?? null,
    description: e.description ?? null,
  }));
  await prisma.ledgerEntry.createMany({ data: rows });
}

/** Sum an account's balance (debit - credit for assets/expenses; opposite for liab/rev). */
export async function balance(code: string): Promise<{ debit: bigint; credit: bigint; net: bigint; type: AccountType }> {
  const prisma = getPrisma();
  const acct = await prisma.account.findUnique({ where: { code } });
  if (!acct) return { debit: 0n, credit: 0n, net: 0n, type: 'asset' };
  const rows = await prisma.ledgerEntry.groupBy({
    by: ['accountId'],
    where: { accountId: acct.id },
    _sum: { debitHalalahs: true, creditHalalahs: true },
  });
  const d = rows[0]?._sum.debitHalalahs  ?? 0n;
  const c = rows[0]?._sum.creditHalalahs ?? 0n;
  const type = acct.type as AccountType;
  const net = (type === 'asset' || type === 'expense') ? (d - c) : (c - d);
  return { debit: d, credit: c, net, type };
}

// ---------------- High-level posters used by the payment orchestrator ----------------

/**
 * Post the ledger for a captured payment.
 *
 *   Dr PSP_CLEARING                  gross
 *   Dr PAYMENT_GATEWAY_FEE           gatewayFee
 *     Cr HOST_PAYABLE:host           gross - platformFee - vatOnRental (or OWNER_PAYABLE)
 *     Cr PLATFORM_REVENUE            platformFee - officeShare - marketerShare
 *     Cr OFFICE_PAYABLE:<office>     officeShare      (if any)
 *     Cr MARKETER_PAYABLE:<marketer> marketerShare    (if any)
 *     Cr VAT_PAYABLE                 vatTotal
 *
 * Simplification: gatewayFee is booked as expense against PSP_CLEARING
 * (the PSP effectively already withheld it — this is a bookkeeping split).
 */
export async function postCaptureEntries(args: {
  paymentId: string;
  bookingId: string;
  quote: Quote;
  gatewayFeeHalalahs: bigint;
  hostUserId?: string | null;
  ownerUserId?: string | null;
  officeId?: string | null;
  marketerId?: string | null;
}): Promise<void> {
  const { quote } = args;
  const grossPaid = quote.customerTotalHalalahs;

  const psp = await ensureAccount('PSP_CLEARING',
    { name: 'PSP clearing', type: 'asset' });
  const gwFee = await ensureAccount('PAYMENT_GATEWAY_FEE',
    { name: 'Payment gateway fee', type: 'expense' });
  const revenue = await ensureAccount('PLATFORM_REVENUE',
    { name: 'Platform net revenue', type: 'revenue' });
  const vat = await ensureAccount('VAT_PAYABLE',
    { name: 'VAT payable to ZATCA', type: 'liability' });

  const totalVat = quote.taxOnPlatformFee.taxAmountHalalahs + quote.taxOnRental.taxAmountHalalahs;
  const beneficiaryAmount = quote.commission.hostAmountHalalahs || quote.commission.ownerAmountHalalahs;

  const isHost = quote.commission.hostAmountHalalahs > 0n;
  const beneficiaryCode = isHost
    ? `HOST_PAYABLE:${args.hostUserId ?? 'unknown'}`
    : `OWNER_PAYABLE:${args.ownerUserId ?? 'unknown'}`;
  const beneficiaryAcct = await ensureAccount(beneficiaryCode, {
    name: isHost ? 'Host payable' : 'Owner payable',
    type: 'liability',
    ownerUserId: isHost ? args.hostUserId ?? undefined : args.ownerUserId ?? undefined,
  });

  const entries: Entry[] = [
    { accountId: psp,             debitHalalahs: grossPaid,  description: 'Cash received via PSP' },
    { accountId: beneficiaryAcct, creditHalalahs: beneficiaryAmount, description: 'Amount owed to host/owner' },
    { accountId: revenue,         creditHalalahs: quote.platformNetRevenueHalalahs, description: 'Platform net revenue' },
  ];

  if (quote.commission.officeShareHalalahs > 0n && args.officeId) {
    const office = await ensureAccount(`OFFICE_PAYABLE:${args.officeId}`,
      { name: 'Office payable', type: 'liability' });
    entries.push({ accountId: office, creditHalalahs: quote.commission.officeShareHalalahs, description: 'Office share' });
  }
  if (quote.commission.marketerShareHalalahs > 0n && args.marketerId) {
    const marketer = await ensureAccount(`MARKETER_PAYABLE:${args.marketerId}`,
      { name: 'Marketer payable', type: 'liability' });
    entries.push({ accountId: marketer, creditHalalahs: quote.commission.marketerShareHalalahs, description: 'Marketer share' });
  }
  if (totalVat > 0n) {
    entries.push({ accountId: vat, creditHalalahs: totalVat, description: 'VAT collected' });
  }
  if (args.gatewayFeeHalalahs > 0n) {
    entries.push({ accountId: gwFee, debitHalalahs: args.gatewayFeeHalalahs, description: 'PSP fee' });
    entries.push({ accountId: psp,   creditHalalahs: args.gatewayFeeHalalahs, description: 'PSP fee withheld' });
  }

  await postEntries({
    transactionRef: `capture:${args.paymentId}`,
    paymentId: args.paymentId,
    bookingId: args.bookingId,
    entries,
  });
}

/**
 * Post reverse entries for a refund. Never modify/delete existing entries.
 * Handles both full and partial refunds by prorating each leg to the refund
 * ratio: refundAmount / originalCustomerTotal.
 */
export async function postRefundEntries(args: {
  refundId: string;
  originalPaymentId: string;
  originalQuote: Quote;
  refundAmountHalalahs: bigint;
  hostUserId?: string | null;
  ownerUserId?: string | null;
  officeId?: string | null;
  marketerId?: string | null;
}): Promise<void> {
  const original = args.originalQuote.customerTotalHalalahs;
  if (original === 0n) throw new Error('cannot refund zero-total payment');

  const psp = await ensureAccount('PSP_CLEARING', { name: 'PSP clearing', type: 'asset' });
  const revenue = await ensureAccount('PLATFORM_REVENUE', { name: 'Platform net revenue', type: 'revenue' });
  const vat = await ensureAccount('VAT_PAYABLE', { name: 'VAT payable to ZATCA', type: 'liability' });
  const isHost = args.originalQuote.commission.hostAmountHalalahs > 0n;
  const beneficiaryCode = isHost
    ? `HOST_PAYABLE:${args.hostUserId ?? 'unknown'}`
    : `OWNER_PAYABLE:${args.ownerUserId ?? 'unknown'}`;
  const beneficiaryAcct = await ensureAccount(beneficiaryCode, {
    name: isHost ? 'Host payable' : 'Owner payable', type: 'liability',
    ownerUserId: isHost ? args.hostUserId ?? undefined : args.ownerUserId ?? undefined,
  });

  const num = args.refundAmountHalalahs;
  const share = (h: bigint) => (h * num) / original;   // integer proration

  const beneReverse = share(args.originalQuote.commission.hostAmountHalalahs || args.originalQuote.commission.ownerAmountHalalahs);
  const revenueReverse = share(args.originalQuote.platformNetRevenueHalalahs);
  const vatReverse = share(args.originalQuote.taxOnPlatformFee.taxAmountHalalahs + args.originalQuote.taxOnRental.taxAmountHalalahs);
  const officeReverse = share(args.originalQuote.commission.officeShareHalalahs);
  const marketerReverse = share(args.originalQuote.commission.marketerShareHalalahs);

  const entries: Entry[] = [
    { accountId: psp,             creditHalalahs: args.refundAmountHalalahs, description: 'Refund out' },
    { accountId: beneficiaryAcct, debitHalalahs: beneReverse,               description: 'Reverse host/owner payable' },
    { accountId: revenue,         debitHalalahs: revenueReverse,            description: 'Reverse platform revenue' },
  ];
  if (vatReverse > 0n) {
    entries.push({ accountId: vat, debitHalalahs: vatReverse, description: 'Reverse VAT payable' });
  }
  if (officeReverse > 0n && args.officeId) {
    const office = await ensureAccount(`OFFICE_PAYABLE:${args.officeId}`, { name: 'Office payable', type: 'liability' });
    entries.push({ accountId: office, debitHalalahs: officeReverse, description: 'Reverse office share' });
  }
  if (marketerReverse > 0n && args.marketerId) {
    const marketer = await ensureAccount(`MARKETER_PAYABLE:${args.marketerId}`, { name: 'Marketer payable', type: 'liability' });
    entries.push({ accountId: marketer, debitHalalahs: marketerReverse, description: 'Reverse marketer share' });
  }

  // If integer proration leaves a tiny residual, park it in PLATFORM_REVENUE so the entry balances.
  const debit = entries.reduce((s, e) => s + (e.debitHalalahs ?? 0n), 0n);
  const credit = entries.reduce((s, e) => s + (e.creditHalalahs ?? 0n), 0n);
  const diff = debit - credit;
  if (diff !== 0n) {
    entries.push({ accountId: revenue, debitHalalahs: diff < 0n ? -diff : 0n, creditHalalahs: diff > 0n ? diff : 0n, description: 'Rounding residual' });
  }

  await postEntries({
    transactionRef: `refund:${args.refundId}`,
    paymentId: args.originalPaymentId,
    refundId: args.refundId,
    entries,
  });
}
