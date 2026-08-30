import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDb, shutdown, buildTestApp } from './helpers.js';
import accountRoutes from '../src/routes/account.js';
import { getPrisma } from '../src/db.js';
import { halalahsFromMajor } from '../src/money.js';

async function server() {
  return buildTestApp(async (a) => { await a.register(accountRoutes); });
}

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await shutdown(); });

describe('GET /v1/account/export', () => {
  it('returns the caller\'s own data footprint only', async () => {
    const prisma = getPrisma();
    const alice = await prisma.user.create({ data: { phone: '+9660901', nameAr: 'أ' } });
    const host  = await prisma.user.create({ data: { phone: '+9660902', nameAr: 'م' } });
    const property = await prisma.property.create({
      data: { listingNumber: 'L-EXP-1', ownerId: host.id, category: 'apartment', purpose: 'daily' },
    });
    await prisma.booking.create({
      data: {
        propertyId: property.id, customerId: alice.id, hostId: host.id,
        transactionType: 'DAILY_RENTAL', grossAmountHalalahs: halalahsFromMajor('300'),
        currency: 'SAR', status: 'draft',
      },
    });

    const app = await server();
    const res = await app.inject({
      method: 'GET', url: '/v1/account/export',
      headers: { 'x-user-id': alice.id, 'x-user-role': 'CUSTOMER' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.id).toBe(alice.id);
    expect(body.bookings.length).toBe(1);
    expect(body.bookings[0].customerId).toBe(alice.id);
    await app.close();
  });

  it('does NOT leak another user\'s data', async () => {
    const prisma = getPrisma();
    const alice = await prisma.user.create({ data: { phone: '+9660903', nameAr: 'أ' } });
    const bob   = await prisma.user.create({ data: { phone: '+9660904', nameAr: 'ب' } });
    const host  = await prisma.user.create({ data: { phone: '+9660905', nameAr: 'م' } });
    const property = await prisma.property.create({
      data: { listingNumber: 'L-EXP-2', ownerId: host.id, category: 'apartment', purpose: 'daily' },
    });
    // Only Alice has a booking.
    await prisma.booking.create({
      data: {
        propertyId: property.id, customerId: alice.id, hostId: host.id,
        transactionType: 'DAILY_RENTAL', grossAmountHalalahs: halalahsFromMajor('500'),
        currency: 'SAR', status: 'confirmed',
      },
    });
    const app = await server();
    // Bob exports — should see nothing about Alice.
    const res = await app.inject({
      method: 'GET', url: '/v1/account/export',
      headers: { 'x-user-id': bob.id, 'x-user-role': 'CUSTOMER' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.id).toBe(bob.id);
    expect(body.bookings.length).toBe(0);
    expect(body.payments.length).toBe(0);
    await app.close();
  });

  it('is unauthenticated → 401', async () => {
    const app = await server();
    const res = await app.inject({ method: 'GET', url: '/v1/account/export' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('writes an audit record on export', async () => {
    const prisma = getPrisma();
    const alice = await prisma.user.create({ data: { phone: '+9660906', nameAr: 'أ' } });
    const app = await server();
    const res = await app.inject({
      method: 'GET', url: '/v1/account/export',
      headers: { 'x-user-id': alice.id, 'x-user-role': 'CUSTOMER' },
    });
    expect(res.statusCode).toBe(200);
    const audits = await prisma.auditLog.findMany({ where: { actorId: alice.id, action: 'ACCOUNT.EXPORTED' } });
    expect(audits.length).toBe(1);
    await app.close();
  });
});
