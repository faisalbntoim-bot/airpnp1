/**
 * IDOR / cross-user access tests.
 *
 * User A must not be able to read or mutate any of User B's resources when they
 * only know the resource id: booking, payment, refund, invoice, wallet balances,
 * settlements, or property listings.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDb, seedRules, shutdown, buildTestApp } from './helpers.js';
import { getPrisma } from '../src/db.js';
import { halalahsFromMajor } from '../src/money.js';
import bookingRoutes from '../src/routes/bookings.js';
import paymentRoutes from '../src/routes/payments.js';
import refundRoutes from '../src/routes/refunds.js';
import walletRoutes from '../src/routes/wallet.js';
import invoiceRoutes from '../src/routes/invoices.js';
import propertyRoutes from '../src/routes/properties.js';

async function server() {
  return buildTestApp(async (app) => {
    await app.register(bookingRoutes);
    await app.register(paymentRoutes);
    await app.register(refundRoutes);
    await app.register(walletRoutes);
    await app.register(invoiceRoutes);
    await app.register(propertyRoutes);
  });
}

beforeEach(async () => { await resetDb(); await seedRules(); });
afterAll(async () => { await shutdown(); });

async function makeTwoUsersWithBooking() {
  const prisma = getPrisma();
  const alice = await prisma.user.create({ data: { phone: '+9660001', nameAr: 'أليس' } });
  const bob   = await prisma.user.create({ data: { phone: '+9660002', nameAr: 'بوب' } });
  const host  = await prisma.user.create({ data: { phone: '+9660003', nameAr: 'مضيف' } });

  const property = await prisma.property.create({
    data: { listingNumber: 'L-IDOR-1', ownerId: host.id, category: 'apartment', purpose: 'daily' },
  });
  await prisma.propertyHost.create({ data: { propertyId: property.id, hostId: host.id, isPrimary: true } });

  const bookingA = await prisma.booking.create({
    data: {
      propertyId: property.id, customerId: alice.id, hostId: host.id,
      transactionType: 'DAILY_RENTAL', grossAmountHalalahs: halalahsFromMajor('300'),
      currency: 'SAR', status: 'draft',
    },
  });
  return { alice, bob, host, property, bookingA };
}

describe('IDOR — Booking', () => {
  it('B cannot read A\'s booking (returns 404)', async () => {
    const { alice, bob, bookingA } = await makeTwoUsersWithBooking();
    const app = await server();
    const res = await app.inject({
      method: 'GET', url: `/v1/bookings/${bookingA.id}`,
      headers: { 'x-user-id': bob.id, 'x-user-role': 'CUSTOMER' },
    });
    expect(res.statusCode).toBe(404);
    // A can read their own.
    const ok = await app.inject({
      method: 'GET', url: `/v1/bookings/${bookingA.id}`,
      headers: { 'x-user-id': alice.id, 'x-user-role': 'CUSTOMER' },
    });
    expect(ok.statusCode).toBe(200);
    await app.close();
  });
});

describe('IDOR — Payment start (B2)', () => {
  it('B cannot start checkout on A\'s booking', async () => {
    const { bob, bookingA } = await makeTwoUsersWithBooking();
    const app = await server();
    const res = await app.inject({
      method: 'POST', url: '/v1/payments',
      payload: { bookingId: bookingA.id },
      headers: { 'content-type': 'application/json', 'x-user-id': bob.id, 'x-user-role': 'CUSTOMER' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('IDOR — Refund (B1)', () => {
  it('a HOST for a different property cannot refund another host\'s payment', async () => {
    const prisma = getPrisma();
    const { alice, host, property, bookingA } = await makeTwoUsersWithBooking();

    // Another (unrelated) host.
    const otherHost = await prisma.user.create({ data: { phone: '+9660009', nameAr: 'مضيف آخر' } });

    // Create a captured Payment for booking A.
    const payment = await prisma.payment.create({
      data: {
        bookingId: bookingA.id, type: 'CHARGE',
        grossAmountHalalahs: halalahsFromMajor('317.25'), currency: 'SAR',
        status: 'captured', provider: 'sandbox',
        idempotencyKey: 'idem-idor-1',
        metadata: JSON.stringify({ quote: {} }),
      },
    });

    const app = await server();
    const res = await app.inject({
      method: 'POST', url: `/v1/payments/${payment.id}/refund`,
      payload: {},
      headers: {
        'content-type': 'application/json',
        'x-user-id': otherHost.id, 'x-user-role': 'HOST',
        'idempotency-key': 'idor-ref-1',
      },
    });
    expect(res.statusCode).toBe(404);
    // Note: pass an admin and the endpoint would proceed (tested elsewhere in refund.test.ts).
    // Ensure the actual host of the booking is not the attacker.
    expect(bookingA.hostId).toBe(host.id);
    expect(otherHost.id).not.toBe(host.id);
    // Alice (the customer) is not authorised to refund either.
    const alice404 = await app.inject({
      method: 'POST', url: `/v1/payments/${payment.id}/refund`,
      payload: {},
      headers: {
        'content-type': 'application/json',
        'x-user-id': alice.id, 'x-user-role': 'CUSTOMER',
      },
    });
    expect(alice404.statusCode).toBe(403);      // CUSTOMER not in the allowed role list
    void property;
    await app.close();
  });
});

describe('IDOR — Wallet', () => {
  it('B\'s wallet endpoint returns B\'s balances only (not A\'s)', async () => {
    const prisma = getPrisma();
    const { alice, bob } = await makeTwoUsersWithBooking();
    // Seed a HOST_PAYABLE account for A only.
    const acct = await prisma.account.create({
      data: { code: `HOST_PAYABLE:${alice.id}`, name: 'Alice host payable', type: 'liability', ownerUserId: alice.id },
    });
    await prisma.ledgerEntry.createMany({
      data: [
        { accountId: acct.id, transactionRef: 't1', creditHalalahs: 12345n },
      ],
    });

    const app = await server();
    const bWallet = await app.inject({
      method: 'GET', url: '/v1/wallet',
      headers: { 'x-user-id': bob.id, 'x-user-role': 'CUSTOMER' },
    });
    expect(bWallet.statusCode).toBe(200);
    expect(bWallet.json().ledger.hostPayable).toBe('0');   // B sees zero — never A's numbers

    const aWallet = await app.inject({
      method: 'GET', url: '/v1/wallet',
      headers: { 'x-user-id': alice.id, 'x-user-role': 'CUSTOMER' },
    });
    expect(aWallet.json().ledger.hostPayable).toBe('12345');
    await app.close();
  });
});

describe('IDOR — Invoice', () => {
  it('B cannot read A\'s invoice', async () => {
    const prisma = getPrisma();
    const { alice, bob, bookingA } = await makeTwoUsersWithBooking();
    const payment = await prisma.payment.create({
      data: {
        bookingId: bookingA.id, type: 'CHARGE', grossAmountHalalahs: halalahsFromMajor('300'),
        currency: 'SAR', status: 'captured', provider: 'sandbox', idempotencyKey: 'k-inv',
      },
    });
    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber: 'SKN-9999-000001', paymentId: payment.id, bookingId: bookingA.id,
        sellerName: 'SakanHub', buyerName: 'Alice',
        subtotalHalalahs: 30000n, taxableAmountHalalahs: 1500n, taxRatePercent: 15,
        taxAmountHalalahs: 225n, totalHalalahs: 31725n, currency: 'SAR',
      },
    });

    const app = await server();
    const denied = await app.inject({
      method: 'GET', url: `/v1/invoices/${inv.id}`,
      headers: { 'x-user-id': bob.id, 'x-user-role': 'CUSTOMER' },
    });
    expect(denied.statusCode).toBe(404);

    const ok = await app.inject({
      method: 'GET', url: `/v1/invoices/${inv.id}`,
      headers: { 'x-user-id': alice.id, 'x-user-role': 'CUSTOMER' },
    });
    expect(ok.statusCode).toBe(200);
    await app.close();
  });
});

describe('IDOR — Properties owner filter', () => {
  it('B cannot list A\'s reserved/hidden properties via ownerId filter', async () => {
    const prisma = getPrisma();
    const { alice, bob } = await makeTwoUsersWithBooking();
    // A hidden listing owned by Alice.
    await prisma.property.create({
      data: { listingNumber: 'L-HIDDEN', ownerId: alice.id, category: 'villa', purpose: 'sale', status: 'hidden' },
    });

    const app = await server();
    const res = await app.inject({
      method: 'GET', url: `/v1/properties?ownerId=${alice.id}&status=hidden`,
      headers: { 'x-user-id': bob.id, 'x-user-role': 'CUSTOMER' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().items.length).toBe(0);   // filter is silently nulled for non-owner/non-admin
    await app.close();
  });
});
