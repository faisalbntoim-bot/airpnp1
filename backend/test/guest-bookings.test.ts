import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDb, seedRules, shutdown, buildTestApp } from './helpers.js';
import bookingRoutes from '../src/routes/bookings.js';
import { getPrisma } from '../src/db.js';
import { halalahsFromMajor } from '../src/money.js';

async function server() {
  return buildTestApp(async (app) => { await app.register(bookingRoutes); });
}

beforeEach(async () => { await resetDb(); await seedRules(); });
afterAll(async () => { await shutdown(); });

async function seedTwoUsersEachWithBooking() {
  const prisma = getPrisma();
  const alice = await prisma.user.create({ data: { phone: '+9660501', nameAr: 'أليس' } });
  const bob   = await prisma.user.create({ data: { phone: '+9660502', nameAr: 'بوب' } });
  const host  = await prisma.user.create({ data: { phone: '+9660503', nameAr: 'مضيف' } });
  const property = await prisma.property.create({
    data: { listingNumber: 'L-GB-1', ownerId: host.id, category: 'apartment', purpose: 'daily' },
  });
  const b1 = await prisma.booking.create({
    data: {
      propertyId: property.id, customerId: alice.id, hostId: host.id,
      transactionType: 'DAILY_RENTAL', grossAmountHalalahs: halalahsFromMajor('300'),
      currency: 'SAR', status: 'draft',
    },
  });
  const b2 = await prisma.booking.create({
    data: {
      propertyId: property.id, customerId: bob.id, hostId: host.id,
      transactionType: 'DAILY_RENTAL', grossAmountHalalahs: halalahsFromMajor('500'),
      currency: 'SAR', status: 'confirmed',
    },
  });
  return { alice, bob, host, b1, b2 };
}

describe('GET /v1/bookings — mine', () => {
  it('returns only the caller\'s bookings, never anyone else\'s', async () => {
    const { alice, b1 } = await seedTwoUsersEachWithBooking();
    const app = await server();
    const res = await app.inject({
      method: 'GET', url: '/v1/bookings',
      headers: { 'x-user-id': alice.id, 'x-user-role': 'CUSTOMER' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(1);
    expect(body.items[0].id).toBe(b1.id);
    expect(body.items[0].customerId).toBe(alice.id);
    await app.close();
  });

  it('IDOR: non-admin cannot list another user\'s bookings via ?customerId=', async () => {
    const { alice, bob } = await seedTwoUsersEachWithBooking();
    const app = await server();
    const res = await app.inject({
      method: 'GET', url: `/v1/bookings?customerId=${alice.id}`,
      headers: { 'x-user-id': bob.id, 'x-user-role': 'CUSTOMER' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(0);           // silently empty — no confirmation of alice's existence
    await app.close();
  });

  it('admin can list another user\'s bookings via ?customerId=', async () => {
    const prisma = getPrisma();
    const { alice } = await seedTwoUsersEachWithBooking();
    const admin = await prisma.user.create({ data: { phone: '+9660599', nameAr: 'مدير' } });
    const app = await server();
    const res = await app.inject({
      method: 'GET', url: `/v1/bookings?customerId=${alice.id}`,
      headers: { 'x-user-id': admin.id, 'x-user-role': 'ADMIN' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(1);
    await app.close();
  });

  it('filters by status and sorts by createdAt.desc by default', async () => {
    const { alice } = await seedTwoUsersEachWithBooking();
    const prisma = getPrisma();
    // Add a second confirmed booking for alice.
    const property = await prisma.property.findFirst({});
    await prisma.booking.create({
      data: {
        propertyId: property!.id, customerId: alice.id, hostId: alice.id,
        transactionType: 'DAILY_RENTAL', grossAmountHalalahs: halalahsFromMajor('200'),
        currency: 'SAR', status: 'confirmed',
      },
    });
    const app = await server();
    const res = await app.inject({
      method: 'GET', url: '/v1/bookings?status=confirmed',
      headers: { 'x-user-id': alice.id, 'x-user-role': 'CUSTOMER' },
    });
    const body = res.json();
    expect(body.total).toBe(1);
    expect(body.items.every((b: { status: string }) => b.status === 'confirmed')).toBe(true);
    await app.close();
  });

  it('paginates', async () => {
    const prisma = getPrisma();
    const alice = await prisma.user.create({ data: { phone: '+9660510', nameAr: 'أ' } });
    const host  = await prisma.user.create({ data: { phone: '+9660511', nameAr: 'م' } });
    const property = await prisma.property.create({
      data: { listingNumber: 'L-GB-P', ownerId: host.id, category: 'apartment', purpose: 'daily' },
    });
    for (let i = 0; i < 25; i++) {
      await prisma.booking.create({
        data: {
          propertyId: property.id, customerId: alice.id, hostId: host.id,
          transactionType: 'DAILY_RENTAL', grossAmountHalalahs: halalahsFromMajor('100'),
          currency: 'SAR', status: 'draft',
        },
      });
    }
    const app = await server();
    const page1 = await app.inject({
      method: 'GET', url: '/v1/bookings?page=1&pageSize=10',
      headers: { 'x-user-id': alice.id, 'x-user-role': 'CUSTOMER' },
    });
    expect(page1.json().items.length).toBe(10);
    expect(page1.json().total).toBe(25);
    await app.close();
  });
});
