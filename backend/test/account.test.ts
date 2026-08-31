import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDb, shutdown, buildTestApp } from './helpers.js';
import accountRoutes from '../src/routes/account.js';
import { getPrisma } from '../src/db.js';

async function server() {
  return buildTestApp(async (app) => { await app.register(accountRoutes); });
}

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await shutdown(); });

describe('DELETE /v1/account', () => {
  it('rejects without confirm:"DELETE"', async () => {
    const prisma = getPrisma();
    const user = await prisma.user.create({ data: { phone: '+9660050', nameAr: 'مستخدم' } });
    const app = await server();
    const res = await app.inject({
      method: 'DELETE', url: '/v1/account',
      payload: { reason: 'test' },
      headers: { 'content-type': 'application/json', 'x-user-id': user.id, 'x-user-role': 'CUSTOMER' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('anonymises the user and hides their properties, keeps financial rows intact', async () => {
    const prisma = getPrisma();
    const user = await prisma.user.create({ data: { phone: '+9660051', nameAr: 'أحمد', email: 'a@x.com' } });
    await prisma.property.create({
      data: { listingNumber: 'L-DEL-1', ownerId: user.id, category: 'apartment', purpose: 'daily', status: 'available' },
    });

    const app = await server();
    const res = await app.inject({
      method: 'DELETE', url: '/v1/account',
      payload: { reason: 'no longer needed', confirm: 'DELETE' },
      headers: { 'content-type': 'application/json', 'x-user-id': user.id, 'x-user-role': 'CUSTOMER' },
    });
    expect(res.statusCode).toBe(200);

    const after = await prisma.user.findUnique({ where: { id: user.id } });
    expect(after?.phone).toMatch(/^deleted:/);
    expect(after?.email).toBeNull();
    expect(after?.nameAr).toBe('[محذوف]');
    expect(after?.status).toBe('closed');

    const props = await prisma.property.findMany({ where: { ownerId: user.id } });
    expect(props.every((p) => p.status === 'hidden')).toBe(true);
    await app.close();
  });

  it('refuses deletion while money is in flight', async () => {
    const prisma = getPrisma();
    const user = await prisma.user.create({ data: { phone: '+9660052', nameAr: 'ب' } });
    const host = await prisma.user.create({ data: { phone: '+9660053', nameAr: 'مضيف' } });
    const property = await prisma.property.create({
      data: { listingNumber: 'L-DEL-2', ownerId: host.id, category: 'apartment', purpose: 'daily' },
    });
    const booking = await prisma.booking.create({
      data: {
        propertyId: property.id, customerId: user.id, hostId: host.id,
        transactionType: 'DAILY_RENTAL', grossAmountHalalahs: 30000n, currency: 'SAR', status: 'pending_payment',
      },
    });
    await prisma.payment.create({
      data: {
        bookingId: booking.id, type: 'CHARGE', grossAmountHalalahs: 30000n, currency: 'SAR',
        status: 'pending', provider: 'sandbox', idempotencyKey: 'idem-del-1',
      },
    });

    const app = await server();
    const res = await app.inject({
      method: 'DELETE', url: '/v1/account',
      payload: { confirm: 'DELETE' },
      headers: { 'content-type': 'application/json', 'x-user-id': user.id, 'x-user-role': 'CUSTOMER' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().message).toMatch(/pending/i);
    await app.close();
  });
});
