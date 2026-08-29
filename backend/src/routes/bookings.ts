import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '../db.js';
import { requireAuth } from '../auth/rbac.js';
import { badRequest, notFound } from '../errors.js';
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

    // Determine host from PropertyHost for DAILY_RENTAL, else owner.
    let hostId = property.ownerId;
    if (body.transactionType === 'DAILY_RENTAL') {
      const primary = await prisma.propertyHost.findFirst({ where: { propertyId: property.id, isPrimary: true } });
      hostId = primary?.hostId ?? property.ownerId;
    }

    const booking = await prisma.booking.create({
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

    // Attach a quote preview to the response.
    const quote = await computeQuote({
      transactionType: body.transactionType,
      propertyType: property.category,
      grossAmountHalalahs: gross,
      currency: body.currency,
    });
    return jsonSafe({ booking, quote });
  });

  app.get('/v1/bookings/:id', async (req, reply) => {
    const caller = requireAuth(req, reply);
    const { id } = req.params as { id: string };
    const booking = await getPrisma().booking.findUnique({
      where: { id },
      include: { items: true, payments: true, invoice: true, property: true },
    });
    if (!booking) throw notFound('booking not found');
    if (booking.customerId !== caller.userId && caller.role !== 'ADMIN' && caller.userId !== booking.hostId) {
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
