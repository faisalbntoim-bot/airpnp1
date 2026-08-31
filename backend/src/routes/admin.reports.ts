import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../auth/rbac.js';
import { platformOverview } from '../financial/reporting.js';
import { jsonSafe } from '../money.js';

const rangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export default async function adminReportRoutes(app: FastifyInstance) {
  const adminOnly = requireRole(['ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN']);

  app.get('/v1/admin/overview', async (req, reply) => {
    adminOnly(req, reply);
    const q = rangeSchema.parse(req.query ?? {});
    const overview = await platformOverview({
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
    });
    return jsonSafe(overview);
  });
}
