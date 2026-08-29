/**
 * Settlement Engine.
 *
 * On a successful capture we create Settlement rows for every beneficiary
 * (host / owner / office / marketer). They start as PENDING and are moved
 * to ELIGIBLE by an admin/cron once the escrow hold expires, then to
 * PROCESSING → PAID by a payout worker.
 *
 * This scaffold DOES NOT trigger any real payouts. `payoutEligible`
 * requires:
 *   - Beneficiary.payoutEnabled = true
 *   - Beneficiary.user has KYC.level == 'FULL' && status == 'approved'
 */

import { getPrisma } from '../db.js';
import type { Quote } from './pricing.js';

export async function createSettlementsForCapture(args: {
  paymentId: string;
  hostUserId?: string | null;
  ownerUserId?: string | null;
  officeId?: string | null;
  marketerId?: string | null;
  quote: Quote;
  currency: string;
}): Promise<void> {
  const prisma = getPrisma();
  const q = args.quote;

  const targets: Array<{ userId: string | null | undefined; amount: bigint; label: string }> = [
    { userId: args.hostUserId, amount: q.commission.hostAmountHalalahs, label: 'host' },
    { userId: args.ownerUserId, amount: q.commission.ownerAmountHalalahs, label: 'owner' },
    // office/marketer beneficiaries are keyed by user in this scaffold.
  ];

  for (const t of targets) {
    if (!t.userId || t.amount <= 0n) continue;
    const beneficiary = await prisma.beneficiary.findUnique({ where: { userId: t.userId } });
    if (!beneficiary) continue;                              // beneficiary must be set up first
    await prisma.settlement.create({
      data: {
        paymentId: args.paymentId,
        beneficiaryId: beneficiary.id,
        amountHalalahs: t.amount,
        currency: args.currency,
        status: 'PENDING',
      },
    });
  }
}

export async function markEligible(settlementId: string): Promise<void> {
  const prisma = getPrisma();
  const s = await prisma.settlement.findUnique({ where: { id: settlementId }, include: { beneficiary: { include: { user: { include: { kyc: true } } } } } });
  if (!s) throw new Error('settlement not found');
  const kycOk = s.beneficiary.user.kyc?.level === 'FULL' && s.beneficiary.user.kyc?.status === 'approved';
  if (!kycOk || !s.beneficiary.payoutEnabled) {
    throw new Error('beneficiary not eligible for payout (KYC or payoutEnabled)');
  }
  await prisma.settlement.update({ where: { id: settlementId }, data: { status: 'ELIGIBLE', scheduledAt: new Date() } });
}
