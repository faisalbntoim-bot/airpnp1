import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '../db.js';
import { requireAuth, isAdminRole } from '../auth/rbac.js';
import { notFound } from '../errors.js';
import { jsonSafe } from '../money.js';

export default async function invoiceRoutes(app: FastifyInstance) {
  app.get('/v1/invoices', async (req, reply) => {
    const caller = requireAuth(req, reply);
    const q = z.object({
      page: z.coerce.number().int().min(1).max(1000).default(1),
      pageSize: z.coerce.number().int().min(1).max(50).default(20),
      status: z.enum(['draft', 'issued', 'credited', 'cancelled']).optional(),
    }).parse(req.query ?? {});

    const prisma = getPrisma();
    // Scope: the caller's own invoices — via booking.customerId OR booking.hostId.
    // Admins see everything.
    const where = isAdminRole(caller.role)
      ? (q.status ? { status: q.status } : {})
      : {
          ...(q.status ? { status: q.status } : {}),
          booking: {
            OR: [
              { customerId: caller.userId },
              { hostId: caller.userId },
            ],
          },
        };

    const [total, rows] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        orderBy: { issueDate: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return jsonSafe({ items: rows, page: q.page, pageSize: q.pageSize, total });
  });

  app.get('/v1/invoices/:id', async (req, reply) => {
    const caller = requireAuth(req, reply);
    const { id } = req.params as { id: string };
    const invoice = await getPrisma().invoice.findUnique({
      where: { id },
      include: { booking: true, payment: true },
    });
    if (!invoice) throw notFound('invoice not found');
    if (
      !isAdminRole(caller.role) &&
      invoice.booking?.customerId !== caller.userId &&
      invoice.booking?.hostId !== caller.userId
    ) {
      throw notFound('invoice not found');
    }
    return jsonSafe(invoice);
  });
}
