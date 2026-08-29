/**
 * Reporting — aggregations for the Admin/Host/Office/Marketer financial dashboards.
 *
 * All money values returned as strings (BigInt-safe over JSON).
 */

import { getPrisma } from '../db.js';
import { balance } from './ledger.js';

export async function platformOverview(range?: { from?: Date; to?: Date }) {
  const prisma = getPrisma();
  const where = range?.from || range?.to ? { createdAt: { gte: range?.from, lte: range?.to } } : {};

  const [payments, refunds, settlements] = await Promise.all([
    prisma.payment.groupBy({ by: ['status'], where, _sum: { grossAmountHalalahs: true, gatewayFeeHalalahs: true }, _count: true }),
    prisma.refund.groupBy({ by: ['status'], where, _sum: { amountHalalahs: true }, _count: true }),
    prisma.settlement.groupBy({ by: ['status'], where, _sum: { amountHalalahs: true }, _count: true }),
  ]);
  const [revenue, vat, gwFee, pspCash] = await Promise.all([
    balance('PLATFORM_REVENUE'),
    balance('VAT_PAYABLE'),
    balance('PAYMENT_GATEWAY_FEE'),
    balance('PSP_CLEARING'),
  ]);

  return {
    payments: stringify(payments),
    refunds: stringify(refunds),
    settlements: stringify(settlements),
    ledgerBalances: {
      platformRevenue: revenue.net.toString(),
      vatPayable: vat.net.toString(),
      gatewayFeesPaid: gwFee.net.toString(),
      pspCashHeld: pspCash.net.toString(),
    },
  };
}

export async function wallet(userId: string) {
  const prisma = getPrisma();
  const b = async (code: string) => (await balance(code)).net;

  // Per-role ledger view (kept for backwards compat).
  const hostPayable     = await b(`HOST_PAYABLE:${userId}`);
  const ownerPayable    = await b(`OWNER_PAYABLE:${userId}`);
  const officePayable   = await b(`OFFICE_PAYABLE:${userId}`);
  const marketerPayable = await b(`MARKETER_PAYABLE:${userId}`);

  // Derived balances — never mutate a running `balance` column. These are
  // computed from the immutable ledger + settlement state on every read.
  const beneficiary = await prisma.beneficiary.findUnique({ where: { userId } });
  const settlements = beneficiary
    ? await prisma.settlement.groupBy({
        by: ['status'],
        where: { beneficiaryId: beneficiary.id },
        _sum: { amountHalalahs: true },
      })
    : [];
  const bucket = (status: string) =>
    settlements.find((r) => r.status === status)?._sum.amountHalalahs ?? 0n;

  const paid       = bucket('PAID');
  const processing = bucket('PROCESSING');
  const eligible   = bucket('ELIGIBLE');
  const pending    = bucket('PENDING');
  const failed     = bucket('FAILED');

  // Refunds attributable to this user — we look at ledger reversals on their payable account.
  const refunded = await refundedForUser(userId);
  const totalEarnings = hostPayable + ownerPayable + officePayable + marketerPayable + paid + processing + eligible;

  return {
    // Derived / user-facing:
    availableHalalahs:  eligible.toString(),                    // KYC-cleared, ready to pay out
    pendingHalalahs:    (pending + processing).toString(),      // waiting on hold or in flight
    paidHalalahs:       paid.toString(),                        // sent to bank
    refundedHalalahs:   refunded.toString(),
    failedHalalahs:     failed.toString(),
    totalEarningsHalalahs: totalEarnings.toString(),
    // Raw ledger view (per role):
    ledger: {
      hostPayable:     hostPayable.toString(),
      ownerPayable:    ownerPayable.toString(),
      officePayable:   officePayable.toString(),
      marketerPayable: marketerPayable.toString(),
    },
  };
}

async function refundedForUser(userId: string): Promise<bigint> {
  const prisma = getPrisma();
  // Sum of debit entries on this user's payable accounts that carry a refundId.
  const rows = await prisma.ledgerEntry.groupBy({
    by: ['accountId'],
    where: {
      refundId: { not: null },
      account: { ownerUserId: userId, code: { startsWith: 'HOST_PAYABLE:' } },
    },
    _sum: { debitHalalahs: true },
  });
  return rows.reduce((s, r) => s + (r._sum.debitHalalahs ?? 0n), 0n);
}

function stringify(rows: unknown): unknown {
  return JSON.parse(JSON.stringify(rows, (_k, v) => typeof v === 'bigint' ? v.toString() : v));
}
