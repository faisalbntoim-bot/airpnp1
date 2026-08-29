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
  const b = async (code: string) => (await balance(code)).net;
  return {
    hostPayable:     (await b(`HOST_PAYABLE:${userId}`)).toString(),
    ownerPayable:    (await b(`OWNER_PAYABLE:${userId}`)).toString(),
    officePayable:   (await b(`OFFICE_PAYABLE:${userId}`)).toString(),
    marketerPayable: (await b(`MARKETER_PAYABLE:${userId}`)).toString(),
  };
}

function stringify(rows: unknown): unknown {
  return JSON.parse(JSON.stringify(rows, (_k, v) => typeof v === 'bigint' ? v.toString() : v));
}
