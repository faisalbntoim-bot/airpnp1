/**
 * Refund Engine.
 *
 * Supports FULL_REFUND (amount omitted or equals payment.gross) and
 * PARTIAL_REFUND. Never deletes the original payment — always writes
 * reverse ledger entries. Cancels/adjusts unpaid Settlements.
 */

import { getPrisma } from '../db.js';
import { getProvider } from '../providers/payment-provider.js';
import { postRefundEntries } from './ledger.js';
import { audit } from '../audit.js';
import { withIdempotency } from '../idempotency.js';
import { badRequest, conflict, notFound } from '../errors.js';
import type { Quote } from './pricing.js';

export interface RefundInput {
  paymentId: string;
  idempotencyKey: string;
  amountHalalahs?: bigint;               // undefined = full refund
  reason?: string;
  actorId?: string;
}

export interface RefundResult {
  refundId: string;
  providerRefundId?: string;
  amountHalalahs: bigint;
  status: string;
}

export async function createRefund(input: RefundInput): Promise<RefundResult> {
  return withIdempotency({ key: input.idempotencyKey, scope: 'createRefund', requestBody: { paymentId: input.paymentId, amount: input.amountHalalahs?.toString() } }, async () => {
    const prisma = getPrisma();
    const payment = await prisma.payment.findUnique({ where: { id: input.paymentId }, include: { refunds: true, booking: { include: { property: true } } } });
    if (!payment) throw notFound('payment not found');
    if (payment.status !== 'captured' && payment.status !== 'partial_refunded') {
      throw conflict(`payment status ${payment.status} — cannot refund`);
    }

    const alreadyRefunded = payment.refunds
      .filter((r) => r.status === 'completed' || r.status === 'processing')
      .reduce((sum, r) => sum + r.amountHalalahs, 0n);
    const remaining = payment.grossAmountHalalahs - alreadyRefunded;
    const amount = input.amountHalalahs ?? remaining;
    if (amount <= 0n) throw badRequest('refund amount must be positive');
    if (amount > remaining) throw badRequest(`refund amount (${amount}) exceeds remaining (${remaining})`);

    const provider = await getProvider();
    const providerRefund = await provider.refundPayment({
      providerPaymentId: payment.providerPaymentId!,
      amountHalalahs: amount,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
    });

    const refund = await prisma.refund.create({
      data: {
        paymentId: payment.id, amountHalalahs: amount, currency: payment.currency,
        reason: input.reason ?? null, status: providerRefund.status,
        provider: provider.name, providerRefundId: providerRefund.providerRefundId,
        idempotencyKey: input.idempotencyKey, createdBy: input.actorId ?? null,
        completedAt: providerRefund.status === 'completed' ? new Date() : null,
      },
    });

    // Reverse ledger only when the refund actually completes.
    if (providerRefund.status === 'completed' && payment.booking && payment.metadata) {
      const originalQuote: Quote = deserialiseQuote(JSON.parse(payment.metadata).quote);
      await postRefundEntries({
        refundId: refund.id,
        originalPaymentId: payment.id,
        originalQuote,
        refundAmountHalalahs: amount,
        hostUserId: payment.booking.hostId ?? null,
        ownerUserId: payment.booking.property.ownerId,
        officeId: payment.booking.officeId ?? null,
        marketerId: payment.booking.marketerId ?? null,
      });

      // Cancel PENDING settlements proportionally
      await prisma.settlement.updateMany({
        where: { paymentId: payment.id, status: 'PENDING' },
        data: { status: 'CANCELLED', failureReason: 'refund' },
      });
    }

    const newStatus = (alreadyRefunded + amount === payment.grossAmountHalalahs) ? 'refunded' : 'partial_refunded';
    await prisma.payment.update({ where: { id: payment.id }, data: { status: newStatus } });
    if (payment.booking && newStatus === 'refunded') {
      await prisma.booking.update({ where: { id: payment.booking.id }, data: { status: 'cancelled' } });
    }

    await audit({ actorId: input.actorId, action: 'REFUND.CREATED', entity: 'Refund', entityId: refund.id });

    return { refundId: refund.id, providerRefundId: providerRefund.providerRefundId, amountHalalahs: amount, status: providerRefund.status };
  });
}

function deserialiseQuote(v: unknown): Quote {
  const s = JSON.stringify(v);
  return JSON.parse(s, (_k, val) => (val && typeof val === 'object' && '__bi' in val) ? BigInt((val as { __bi: string }).__bi) : val) as Quote;
}
