import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDb, shutdown, buildTestApp } from './helpers.js';
import invoiceRoutes from '../src/routes/invoices.js';
import { getPrisma } from '../src/db.js';
import { halalahsFromMajor } from '../src/money.js';

async function server() {
  return buildTestApp(async (app) => { await app.register(invoiceRoutes); });
}

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await shutdown(); });

async function seedInvoiceForBoth() {
  const prisma = getPrisma();
  const alice = await prisma.user.create({ data: { phone: '+9660601', nameAr: 'أ' } });
  const bob   = await prisma.user.create({ data: { phone: '+9660602', nameAr: 'ب' } });
  const host  = await prisma.user.create({ data: { phone: '+9660603', nameAr: 'م' } });
  const property = await prisma.property.create({
    data: { listingNumber: 'L-INV-1', ownerId: host.id, category: 'apartment', purpose: 'daily' },
  });
  const booking = await prisma.booking.create({
    data: {
      propertyId: property.id, customerId: alice.id, hostId: host.id,
      transactionType: 'DAILY_RENTAL', grossAmountHalalahs: halalahsFromMajor('300'),
      currency: 'SAR', status: 'confirmed',
    },
  });
  const payment = await prisma.payment.create({
    data: {
      bookingId: booking.id, type: 'CHARGE',
      grossAmountHalalahs: halalahsFromMajor('317.25'), currency: 'SAR',
      status: 'captured', provider: 'sandbox', idempotencyKey: 'k-inv-1',
    },
  });
  const inv = await prisma.invoice.create({
    data: {
      invoiceNumber: 'SKN-9999-000010', paymentId: payment.id, bookingId: booking.id,
      sellerName: 'SakanHub', buyerName: 'أليس',
      subtotalHalalahs: 31500n, taxableAmountHalalahs: 1500n, taxRatePercent: 15,
      taxAmountHalalahs: 225n, totalHalalahs: 31725n, currency: 'SAR', status: 'issued',
    },
  });
  return { alice, bob, host, inv };
}

describe('GET /v1/invoices — scoped list', () => {
  it('customer sees their own invoice', async () => {
    const { alice, inv } = await seedInvoiceForBoth();
    const app = await server();
    const res = await app.inject({
      method: 'GET', url: '/v1/invoices',
      headers: { 'x-user-id': alice.id, 'x-user-role': 'CUSTOMER' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().items.length).toBe(1);
    expect(res.json().items[0].id).toBe(inv.id);
    await app.close();
  });

  it('unrelated user gets an empty list', async () => {
    const { bob } = await seedInvoiceForBoth();
    const app = await server();
    const res = await app.inject({
      method: 'GET', url: '/v1/invoices',
      headers: { 'x-user-id': bob.id, 'x-user-role': 'CUSTOMER' },
    });
    expect(res.json().total).toBe(0);
    await app.close();
  });

  it('host sees the invoice for their booking', async () => {
    const { host, inv } = await seedInvoiceForBoth();
    const app = await server();
    const res = await app.inject({
      method: 'GET', url: '/v1/invoices',
      headers: { 'x-user-id': host.id, 'x-user-role': 'HOST' },
    });
    expect(res.json().items[0].id).toBe(inv.id);
    await app.close();
  });
});
