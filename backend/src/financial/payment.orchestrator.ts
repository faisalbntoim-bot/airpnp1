/**
 * Payment Orchestrator — the single choreographer for the full flow:
 *
 *   book → quote → provider create → (webhook: verify + capture) → ledger → settlement → invoice
 *
 * Never trust the client for "paid". Only a verified webhook (or a signed
 * server-side verifyPayment call) may transition a payment to `captured`.
 */

import { getPrisma } from '../db.js';
import { getProvider } from '../providers/payment-provider.js';
import { computeQuote, type Quote } from './pricing.js';
import type { TransactionType } from './commission.js';
import { postCaptureEntries } from './ledger.js';
import { audit } from '../audit.js';
import { withIdempotency } from '../idempotency.js';
import { conflict, notFound, badRequest } from '../errors.js';
import { createInvoiceForPayment } from './invoice.js';
import { createSettlementsForCapture } from './settlement.js';
import { config } from '../config.js';

export interface StartCheckoutInput {
  bookingId: string;
  idempotencyKey: string;
  customer?: { name?: string; email?: string; phone?: string };
  returnUrl?: string;
}

export interface StartCheckoutResult {
  paymentId: string;
  providerPaymentId: string;
  redirectUrl?: string;
  quote: Quote;
}

export async function startCheckout(input: StartCheckoutInput): Promise<StartCheckoutResult> {
  return withIdempotency({ key: input.idempotencyKey, scope: 'startCheckout', requestBody: { bookingId: input.bookingId } }, async () => {
    const prisma = getPrisma();
    const booking = await prisma.booking.findUnique({ where: { id: input.bookingId }, include: { property: true } });
    if (!booking) throw notFound('booking not found');
    if (booking.status !== 'draft' && booking.status !== 'pending_payment') {
      throw conflict(`booking is ${booking.status}, cannot start checkout`);
    }

    const quote = await computeQuote({
      transactionType: booking.transactionType as TransactionType,
      propertyType: booking.property.category,
      grossAmountHalalahs: booking.grossAmountHalalahs,
      currency: booking.currency,
    });

    const provider = await getProvider();

    // Create a Payment row FIRST (deterministic id we pass to the provider as orderRef).
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        type: 'CHARGE',
        grossAmountHalalahs: quote.customerTotalHalalahs,
        currency: booking.currency,
        status: 'pending',
        provider: provider.name,
        idempotencyKey: input.idempotencyKey,
        metadata: JSON.stringify({ quote: serialiseQuote(quote) }),
      },
    });

    const providerPayment = await provider.createPayment({
      amountHalalahs: quote.customerTotalHalalahs,
      currency: booking.currency,
      orderRef: payment.id,
      description: `Booking ${booking.id} (${booking.transactionType})`,
      customer: input.customer,
      returnUrl: input.returnUrl,
      metadata: { bookingId: booking.id, transactionType: booking.transactionType },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { providerPaymentId: providerPayment.providerPaymentId, providerStatus: providerPayment.status },
    });

    await prisma.booking.update({ where: { id: booking.id }, data: { status: 'pending_payment' } });

    await audit({ action: 'PAYMENT.CREATED', entity: 'Payment', entityId: payment.id });

    return {
      paymentId: payment.id,
      providerPaymentId: providerPayment.providerPaymentId,
      redirectUrl: providerPayment.redirectUrl,
      quote,
    };
  });
}

/**
 * Capture a payment based on a verified webhook (or a verified server-side check).
 * Idempotent: safe to call twice; only the first call posts ledger + creates invoice.
 */
export async function capturePayment(args: {
  paymentId: string;
  providerPaymentId: string;
  gatewayFeeHalalahs?: bigint;
}): Promise<void> {
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: args.paymentId }, include: { booking: { include: { property: true } } } });
    if (!payment) throw notFound(`payment ${args.paymentId} not found`);
    if (payment.status === 'captured') return; // idempotent
    if (payment.status !== 'pending') throw conflict(`payment in status ${payment.status}, cannot capture`);
    if (payment.providerPaymentId !== args.providerPaymentId) throw badRequest('provider payment id mismatch');

    const gatewayFee = args.gatewayFeeHalalahs ?? 0n;
    await tx.payment.update({
      where: { id: args.paymentId },
      data: { status: 'captured', capturedAt: new Date(), gatewayFeeHalalahs: gatewayFee, providerStatus: 'captured' },
    });
    await tx.paymentEvent.create({ data: { paymentId: args.paymentId, kind: 'captured', data: JSON.stringify({ gatewayFee: gatewayFee.toString() }) } });

    if (payment.booking) {
      await tx.booking.update({ where: { id: payment.booking.id }, data: { status: 'confirmed', confirmedAt: new Date() } });
    }
  });

  // Outside the tx: post ledger, create settlement + invoice.
  const payment = await getPrisma().payment.findUnique({ where: { id: args.paymentId }, include: { booking: { include: { property: true } } } });
  if (!payment?.booking) return;

  const quoteFromMetadata = payment.metadata ? deserialiseQuote(JSON.parse(payment.metadata).quote) : null;
  if (!quoteFromMetadata) return;

  await postCaptureEntries({
    paymentId: payment.id,
    bookingId: payment.booking.id,
    quote: quoteFromMetadata,
    gatewayFeeHalalahs: args.gatewayFeeHalalahs ?? 0n,
    hostUserId: payment.booking.hostId ?? null,
    ownerUserId: payment.booking.property.ownerId,
    officeId: payment.booking.officeId ?? null,
    marketerId: payment.booking.marketerId ?? null,
  });

  await createSettlementsForCapture({
    paymentId: payment.id,
    hostUserId: payment.booking.hostId ?? null,
    ownerUserId: payment.booking.property.ownerId,
    officeId: payment.booking.officeId ?? null,
    marketerId: payment.booking.marketerId ?? null,
    quote: quoteFromMetadata,
    currency: payment.currency,
  });

  await createInvoiceForPayment({ paymentId: payment.id });

  await audit({ action: 'PAYMENT.CAPTURED', entity: 'Payment', entityId: payment.id });
}

// ---------------- Quote serialisation (BigInt-safe) ----------------

function serialiseQuote(q: Quote): unknown {
  return JSON.parse(JSON.stringify(q, (_, v) => typeof v === 'bigint' ? { __bi: v.toString() } : v));
}
function deserialiseQuote(v: unknown): Quote {
  const s = JSON.stringify(v);
  return JSON.parse(s, (_k, val) => (val && typeof val === 'object' && '__bi' in val) ? BigInt((val as { __bi: string }).__bi) : val) as Quote;
}
