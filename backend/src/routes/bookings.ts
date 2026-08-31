import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '../db.js';
import { requireAuth, isAdminRole } from '../auth/rbac.js';
import { badRequest, conflict, notFound } from '../errors.js';
import { computeQuote } from '../financial/pricing.js';
import { halalahsFromMajor, jsonSafe } from '../money.js';

const createSchema = z.object({
  propertyId: z.string().min(1),
  transactionType: z.enum(['DAILY_RENTAL', 'LONG_TERM_RENTAL', 'COMMERCIAL_RENTAL', 'SALE']),
  grossAmount: z.union([z.string(), z.number()]),   // in major units (e.g. "300" for 300 SAR)
  currency: z.string().length(3).default('SAR'),
  nights: z.number().int().positive().optional(),
  checkIn: z.string().datetime().optional(),
  checkOut: z.string().datetime().optional(),
  idempotencyKey: z.string().min(4).optional(),
});

export default async function bookingRoutes(app: FastifyInstance) {
  app.post('/v1/bookings', async (req, reply) => {
    const caller = requireAuth(req, reply);
    const body = createSchema.parse(req.body);
    const prisma = getPrisma();
    const property = await prisma.property.findUnique({ where: { id: body.propertyId } });
    if (!property) throw notFound('property not found');

    const gross = halalahsFromMajor(body.grossAmount);
    if (gross <= 0n) throw badRequest('grossAmount must be positive');

    // Currency must match the property.
    if (body.currency !== property.currency) {
      throw badRequest(`booking currency ${body.currency} does not match property currency ${property.currency}`);
    }

    // Determine host from PropertyHost for DAILY_RENTAL, else owner.
    let hostId = property.ownerId;
    if (body.transactionType === 'DAILY_RENTAL') {
      const primary = await prisma.propertyHost.findFirst({ where: { propertyId: property.id, isPrimary: true } });
      hostId = primary?.hostId ?? property.ownerId;
    }

    // Availability guard for date-based transactions: refuse an overlapping booking
    // in a single transaction so two concurrent requests cannot both succeed.
    // NOTE: SQLite serialises writers; Postgres deployments should also apply a
    // property-row SELECT FOR UPDATE inside this tx for the same guarantee.
    const booking = await prisma.$transaction(async (tx) => {
      if (body.checkIn && body.checkOut) {
        const checkIn  = new Date(body.checkIn);
        const checkOut = new Date(body.checkOut);
        if (checkIn.getTime() >= checkOut.getTime()) throw badRequest('checkIn must be before checkOut');
        const overlap = await tx.booking.findFirst({
          where: {
            propertyId: property.id,
            status: { in: ['pending_payment', 'confirmed'] },
            AND: [
              { checkIn:  { lt: checkOut } },
              { checkOut: { gt: checkIn } },
            ],
          },
          select: { id: true },
        });
        if (overlap) throw conflict('property is not available for the selected dates');
      }
      return tx.booking.create({
        data: {
          propertyId: property.id,
          customerId: caller.userId,
          hostId,
          transactionType: body.transactionType,
          checkIn: body.checkIn ? new Date(body.checkIn) : null,
          checkOut: body.checkOut ? new Date(body.checkOut) : null,
          nights: body.nights ?? null,
          grossAmountHalalahs: gross,
          currency: body.currency,
          idempotencyKey: body.idempotencyKey ?? null,
        },
      });
    });

    // Attach a quote preview to the response.
    const quote = await computeQuote({
      transactionType: body.transactionType,
      propertyType: property.category,
      grossAmountHalalahs: gross,
      currency: body.currency,
    });
    return jsonSafe({ booking, quote });
  });

  app.get('/v1/bookings', async (req, reply) => {
    const caller = requireAuth(req, reply);
    const q = z.object({
      page: z.coerce.number().int().min(1).max(1000).default(1),
      pageSize: z.coerce.number().int().min(1).max(50).default(20),
      status: z.enum(['draft', 'pending_payment', 'confirmed', 'cancelled', 'completed']).optional(),
      sort: z.enum(['createdAt.asc', 'createdAt.desc', 'checkIn.asc', 'checkIn.desc']).default('createdAt.desc'),
    }).parse(req.query ?? {});

    // Auth scope: the caller's userId — NEVER read a guestId query parameter.
    // Admins may pass ?customerId=... explicitly to look up another user (admin-only).
    const adminCustomerId = req.query && typeof (req.query as Record<string, unknown>).customerId === 'string'
      ? (req.query as Record<string, string>).customerId
      : undefined;
    let customerId = caller.userId;
    if (adminCustomerId) {
      if (caller.role !== 'ADMIN' && caller.role !== 'FINANCE_ADMIN' && caller.role !== 'SUPER_ADMIN') {
        // Non-admins requesting someone else's list get an empty list, not a 403 (avoids probing).
        return { items: [], page: q.page, pageSize: q.pageSize, total: 0 };
      }
      customerId = adminCustomerId;
    }

    const prisma = getPrisma();
    const where = { customerId, ...(q.status ? { status: q.status } : {}) };
    const [sortField, sortDir] = q.sort.split('.') as ['createdAt' | 'checkIn', 'asc' | 'desc'];
    const [total, rows] = await Promise.all([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        orderBy: { [sortField]: sortDir },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return jsonSafe({ items: rows, page: q.page, pageSize: q.pageSize, total });
  });

  app.get('/v1/bookings/:id', async (req, reply) => {
    const caller = requireAuth(req, reply);
    const { id } = req.params as { id: string };
    const booking = await getPrisma().booking.findUnique({
      where: { id },
      include: { items: true, payments: true, invoice: true, property: true },
    });
    if (!booking) throw notFound('booking not found');
    if (booking.customerId !== caller.userId && !isAdminRole(caller.role) && caller.userId !== booking.hostId) {
      // Owners/hosts/admin can read; others 404 to avoid probing.
      throw notFound('booking not found');
    }
    return jsonSafe(booking);
  });

  app.post('/v1/quote', async (req) => {
    const body = z.object({
      transactionType: z.enum(['DAILY_RENTAL', 'LONG_TERM_RENTAL', 'COMMERCIAL_RENTAL', 'SALE', 'ADVERTISEMENT', 'SUBSCRIPTION', 'SERVICE']),
      propertyType: z.string().optional(),
      grossAmount: z.union([z.string(), z.number()]),
      currency: z.string().length(3).default('SAR'),
    }).parse(req.body);
    const q = await computeQuote({
      transactionType: body.transactionType,
      propertyType: body.propertyType,
      grossAmountHalalahs: halalahsFromMajor(body.grossAmount),
      currency: body.currency,
    });
    return jsonSafe(q);
  });
}
