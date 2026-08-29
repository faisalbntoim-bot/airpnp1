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

const deleteSchema = z.object({
  reason: z.string().max(500).optional(),
  confirm: z.literal('DELETE'),                    // client must send confirm:"DELETE" to prevent misclicks
});

export default async function accountRoutes(app: FastifyInstance) {
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
