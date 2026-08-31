/**
 * Account self-service.
 *
 *   DELETE /v1/account — soft-close the caller's account (PDPL / Apple 5.1.1(v)).
 *
 * We do NOT hard-delete a user row: outstanding financial records
 * (bookings, payments, ledger entries, invoices, tax records) must stay
 * intact for audit + ZATCA retention. Instead:
 *   - phone/email/names are replaced with anonymised placeholders
 *   - status flipped to 'closed'
 *   - all refresh tokens revoked
 *   - any active properties are hidden
 *   - an AuditLog row records the action + optional reason
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '../db.js';
import { requireAuth } from '../auth/rbac.js';
import { revokeAllRefreshTokens } from '../auth/jwt.js';
import { audit } from '../audit.js';
import { conflict } from '../errors.js';
import { jsonSafe } from '../money.js';

const deleteSchema = z.object({
  reason: z.string().max(500).optional(),
  confirm: z.literal('DELETE'),                    // client must send confirm:"DELETE" to prevent misclicks
});

export default async function accountRoutes(app: FastifyInstance) {
  /**
   * PDPL Article 21 subject-access request. Returns the caller's complete
   * personal + financial footprint as one JSON payload. Only the caller can
   * fetch their own export — never anyone else's.
   *
   * The response is written to the audit log (metadata only — the exported
   * data itself is not copied into the audit trail).
   */
  app.get('/v1/account/export', async (req, reply) => {
    const caller = requireAuth(req, reply);
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: caller.userId },
      include: { roles: true, kyc: true, beneficiary: true },
    });
    if (!user) throw conflict('user not found');

    // Load everything scoped to the caller.
    const [bookings, payments, refunds, settlements, invoices, complaints, mediaAssets, ledgerEntries] = await Promise.all([
      prisma.booking.findMany({ where: { OR: [{ customerId: caller.userId }, { hostId: caller.userId }] } }),
      prisma.payment.findMany({ where: { booking: { OR: [{ customerId: caller.userId }, { hostId: caller.userId }] } } }),
      prisma.refund.findMany({ where: { payment: { booking: { OR: [{ customerId: caller.userId }, { hostId: caller.userId }] } } } }),
      prisma.settlement.findMany({ where: { beneficiary: { userId: caller.userId } } }),
      prisma.invoice.findMany({ where: { booking: { OR: [{ customerId: caller.userId }, { hostId: caller.userId }] } } }),
      prisma.complaint.findMany({ where: { complainantId: caller.userId } }),
      prisma.mediaAsset.findMany({ where: { ownerUserId: caller.userId } }),
      prisma.ledgerEntry.findMany({ where: { account: { ownerUserId: caller.userId } }, include: { account: true } }),
    ]);

    await audit({
      actorId: caller.userId, action: 'ACCOUNT.EXPORTED',
      entity: 'User', entityId: caller.userId,
      after: JSON.stringify({
        bookings: bookings.length, payments: payments.length,
        refunds: refunds.length, settlements: settlements.length,
        invoices: invoices.length, complaints: complaints.length,
        mediaAssets: mediaAssets.length, ledgerEntries: ledgerEntries.length,
      }),
    });

    return jsonSafe({
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id, phone: user.phone, email: user.email,
        nameAr: user.nameAr, nameEn: user.nameEn, status: user.status,
        pdplConsentAt: user.pdplConsentAt,
        createdAt: user.createdAt, updatedAt: user.updatedAt,
        roles: user.roles.map((r) => ({ role: r.role, scope: r.scope, grantedAt: r.grantedAt })),
        kyc: user.kyc ? {
          level: user.kyc.level, status: user.kyc.status,
          documentType: user.kyc.documentType,     // note: raw document is NOT here — only the type
          verifiedAt: user.kyc.verifiedAt, expiresAt: user.kyc.expiresAt,
        } : null,
        beneficiary: user.beneficiary ? {
          provider: user.beneficiary.provider,
          ibanMasked: user.beneficiary.ibanMasked,
          payoutEnabled: user.beneficiary.payoutEnabled,
        } : null,
      },
      bookings, payments, refunds, settlements, invoices, complaints, mediaAssets,
      ledger: ledgerEntries,
    });
  });

  app.delete('/v1/account', async (req, reply) => {
    const caller = requireAuth(req, reply);
    const body = deleteSchema.parse(req.body ?? {});
    const prisma = getPrisma();

    // Refuse if the caller still has money-in-flight (pending payment or unpaid settlements).
    const [inFlight, unpaid] = await Promise.all([
      prisma.payment.count({ where: { booking: { customerId: caller.userId }, status: 'pending' } }),
      prisma.settlement.count({ where: { beneficiary: { userId: caller.userId }, status: { in: ['PENDING', 'ELIGIBLE', 'PROCESSING'] } } }),
    ]);
    if (inFlight > 0) throw conflict(`cannot delete — ${inFlight} payment(s) still pending; wait for settlement or cancel first`);
    if (unpaid > 0)   throw conflict(`cannot delete — ${unpaid} settlement(s) still unpaid`);

    // Anonymise identity but keep the row (financial records reference user.id).
    const anonPhone = `deleted:${caller.userId}`;
    await prisma.user.update({
      where: { id: caller.userId },
      data: {
        phone: anonPhone,
        email: null,
        nameAr: '[محذوف]',
        nameEn: null,
        status: 'closed',
        pdplConsentAt: null,
      },
    });

    // Hide their properties from public listings.
    await prisma.property.updateMany({
      where: { ownerId: caller.userId, status: { not: 'hidden' } },
      data: { status: 'hidden' },
    });

    await revokeAllRefreshTokens(caller.userId);
    await audit({
      actorId: caller.userId, action: 'ACCOUNT.DELETED',
      entity: 'User', entityId: caller.userId,
      after: body.reason ? JSON.stringify({ reason: body.reason }) : null,
    });

    return { ok: true, deletedAt: new Date().toISOString() };
  });
}
