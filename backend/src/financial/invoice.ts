/**
 * Invoice Engine.
 *
 * ZATCA (Fatoora, Phase 2) compliance is a real integration project — the
 * shape here is compatible (fields match UBL 2.1 invoice essentials), but
 * we do NOT generate the signed XML/QR yet. `xmlRef` stays null until a
 * ZATCA adapter is wired. Never claim ZATCA compliance without the real
 * cryptographic stamp and API integration.
 */

import { getPrisma } from '../db.js';
import { badRequest } from '../errors.js';
import type { Quote } from './pricing.js';

export async function createInvoiceForPayment(args: { paymentId: string }): Promise<string> {
  const prisma = getPrisma();
  const payment = await prisma.payment.findUnique({
    where: { id: args.paymentId },
    include: { booking: { include: { customer: true } }, invoice: true },
  });
  if (!payment) throw badRequest('payment not found');
  if (payment.invoice) return payment.invoice.id; // idempotent
  if (!payment.metadata) throw badRequest('payment has no quote metadata');

  const q = JSON.parse(payment.metadata).quote as unknown;
  const quote = deserialiseQuote(q);

  const invoiceNumber = await nextInvoiceNumber();
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      paymentId: payment.id,
      bookingId: payment.bookingId ?? null,
      sellerName: 'SakanHub',
      sellerVatNumber: null,           // set once you have the platform's VAT number
      buyerName: payment.booking?.customer.nameAr ?? 'العميل',
      buyerVatNumber: null,
      subtotalHalalahs: quote.grossAmountHalalahs + quote.commission.platformFeeHalalahs,
      taxableAmountHalalahs: quote.commission.platformFeeHalalahs + (quote.taxOnRental.status === 'applied' ? quote.grossAmountHalalahs : 0n),
      taxRatePercent: quote.taxOnPlatformFee.ratePercent,
      taxAmountHalalahs: quote.taxOnPlatformFee.taxAmountHalalahs + quote.taxOnRental.taxAmountHalalahs,
      totalHalalahs: quote.customerTotalHalalahs,
      currency: payment.currency,
      status: 'issued',
      pdfRef: null,
      xmlRef: null,                    // populated once a ZATCA adapter is wired
    },
  });
  return invoice.id;
}

async function nextInvoiceNumber(): Promise<string> {
  // Simple format: SKN-YYYY-<sequential>. Replace with your real numbering scheme
  // (must match ZATCA Fatoora invoice-numbering rules once you integrate).
  const prisma = getPrisma();
  const year = new Date().getFullYear();
  const count = await prisma.invoice.count({ where: { invoiceNumber: { startsWith: `SKN-${year}-` } } });
  return `SKN-${year}-${String(count + 1).padStart(6, '0')}`;
}

function deserialiseQuote(v: unknown): Quote {
  const s = JSON.stringify(v);
  return JSON.parse(s, (_k, val) => (val && typeof val === 'object' && '__bi' in val) ? BigInt((val as { __bi: string }).__bi) : val) as Quote;
}
