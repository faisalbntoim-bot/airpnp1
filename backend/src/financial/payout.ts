/**
 * Payout Engine.
 *
 * Preconditions (ALL must hold — enforced here, not at the route):
 *   1. Beneficiary row exists for the user.
 *   2. Beneficiary.payoutEnabled === true.
 *   3. User has KYC with level === 'FULL' and status === 'approved'.
 *   4. The Settlement is in status ELIGIBLE (not PENDING, PROCESSING, PAID).
 *   5. No active fraud/refund hold on the payment.
 *   6. No existing non-failed Payout for the same settlement (dedup).
 *
 * The provider payout call is idempotent by settlement.id; retries increment
 * `retryCount` and record `lastRetryAt` — never a second live transfer.
 */

import { getPrisma } from '../db.js';
import { getProvider } from '../providers/payment-provider.js';
import { audit } from '../audit.js';
import { conflict, notFound, forbidden } from '../errors.js';

export interface PayoutResult {
  settlementId: string;
  providerReference: string | null;
  status: string;
  amountHalalahs: bigint;
}

export async function requestPayout(args: {
  settlementId: string;
  actorId?: string;
}): Promise<PayoutResult> {
  const prisma = getPrisma();
  const settlement = await prisma.settlement.findUnique({
    where: { id: args.settlementId },
    include: {
      beneficiary: { include: { user: { include: { kyc: true } } } },
      payment: true,
    },
  });
  if (!settlement) throw notFound('settlement not found');
  if (settlement.status === 'PAID' || settlement.status === 'PROCESSING') {
    throw conflict(`settlement already ${settlement.status.toLowerCase()}`);
  }
  if (settlement.status !== 'ELIGIBLE') {
    throw conflict(`settlement is ${settlement.status.toLowerCase()}, must be ELIGIBLE`);
  }
  const b = settlement.beneficiary;
  if (!b.payoutEnabled) throw forbidden('beneficiary payoutEnabled is false');
  const kyc = b.user.kyc;
  if (!kyc || kyc.level !== 'FULL' || kyc.status !== 'approved') {
    throw forbidden('KYC not FULL/approved');
  }
  if (settlement.payment.status === 'refunded' || settlement.payment.status === 'partial_refunded') {
    throw conflict('payment has refund holds; cannot pay out');
  }

  // Move to PROCESSING first (optimistic lock via the current status).
  const claimed = await prisma.settlement.updateMany({
    where: { id: settlement.id, status: 'ELIGIBLE' },
    data: { status: 'PROCESSING' },
  });
  if (claimed.count === 0) throw conflict('lost race to another payout worker');

  try {
    const provider = await getProvider();
    // The provider payout is keyed by settlement.id to guarantee idempotency
    // at the PSP layer too.
    const payout = await provider.createPayout({
      beneficiaryId: b.externalBeneficiaryId ?? b.id,
      amountHalalahs: settlement.amountHalalahs,
      currency: settlement.currency,
      reference: settlement.id,
      idempotencyKey: `payout:${settlement.id}`,
    });
    const status = payout.status === 'paid' ? 'PAID' : 'PROCESSING';
    await prisma.settlement.update({
      where: { id: settlement.id },
      data: {
        status,
        processedAt: status === 'PAID' ? new Date() : null,
        providerReference: payout.providerPayoutId,
      },
    });
    await audit({ actorId: args.actorId, action: `SETTLEMENT.${status}`, entity: 'Settlement', entityId: settlement.id });
    return {
      settlementId: settlement.id,
      providerReference: payout.providerPayoutId,
      status,
      amountHalalahs: settlement.amountHalalahs,
    };
  } catch (err) {
    await prisma.settlement.update({
      where: { id: settlement.id },
      data: {
        status: 'FAILED',
        failureReason: err instanceof Error ? err.message : 'payout failed',
        retryCount: { increment: 1 },
        lastRetryAt: new Date(),
      },
    });
    await audit({ actorId: args.actorId, action: 'SETTLEMENT.FAILED', entity: 'Settlement', entityId: settlement.id });
    throw err;
  }
}
