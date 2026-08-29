import type { FastifyInstance } from 'fastify';
import { getPrisma } from '../db.js';
import { requireAuth } from '../auth/rbac.js';
import { wallet } from '../financial/reporting.js';
import { jsonSafe } from '../money.js';

export default async function walletRoutes(app: FastifyInstance) {
  app.get('/v1/wallet', async (req, reply) => {
    const caller = requireAuth(req, reply);
    const w = await wallet(caller.userId);
    return jsonSafe(w);
  });

  app.get('/v1/settlements', async (req, reply) => {
    const caller = requireAuth(req, reply);
    const prisma = getPrisma();
    const rows = await prisma.settlement.findMany({
      where: { beneficiary: { userId: caller.userId } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return jsonSafe(rows);
  });

  app.get('/v1/transactions', async (req, reply) => {
    const caller = requireAuth(req, reply);
    const prisma = getPrisma();
    // Ledger entries touching this user's payable accounts.
    const entries = await prisma.ledgerEntry.findMany({
      where: {
        account: {
          ownerUserId: caller.userId,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { account: true },
    });
    return jsonSafe(entries);
  });
}
