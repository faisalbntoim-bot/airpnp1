import type { FastifyInstance } from 'fastify';
import { getPrisma } from '../db.js';
import { requireAuth, isAdminRole } from '../auth/rbac.js';
import { notFound } from '../errors.js';
import { jsonSafe } from '../money.js';

export default async function invoiceRoutes(app: FastifyInstance) {
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
