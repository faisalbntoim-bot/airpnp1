import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDb, seedRules, shutdown, makeDailyRentalBooking } from './helpers.js';
import { computeQuote } from '../src/financial/pricing.js';
import { postCaptureEntries, postRefundEntries, balance, ensureAccount, postEntries } from '../src/financial/ledger.js';
import { getPrisma } from '../src/db.js';
import { halalahsFromMajor } from '../src/money.js';

beforeEach(async () => { await resetDb(); await seedRules(); });
afterAll(async () => { await shutdown(); });

describe('ledger — invariants', () => {
  it('postEntries rejects unbalanced debits/credits', async () => {
    const a = await ensureAccount('T_ASSET', { name: 'Test asset', type: 'asset' });
    const b = await ensureAccount('T_REV', { name: 'Test revenue', type: 'revenue' });
    await expect(
      postEntries({
        transactionRef: 'test:1',
        entries: [
          { accountId: a, debitHalalahs: 100n },
          { accountId: b, creditHalalahs: 99n },
        ],
      }),
    ).rejects.toThrow(/not balanced/);
  });

  it('capture posts the exact daily-rental split into the ledger', async () => {
    const { booking, host } = await makeDailyRentalBooking({ grossMajor: '300' });
    const prisma = getPrisma();
    const quote = await computeQuote({
      transactionType: 'DAILY_RENTAL', propertyType: 'apartment',
      grossAmountHalalahs: booking.grossAmountHalalahs,
    });
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id, type: 'CHARGE',
        grossAmountHalalahs: quote.customerTotalHalalahs, currency: 'SAR',
        status: 'captured', provider: 'sandbox',
        idempotencyKey: 'idem-cap-1',
      },
    });
    await postCaptureEntries({
      paymentId: payment.id, bookingId: booking.id, quote,
      gatewayFeeHalalahs: 0n, hostUserId: host.id, ownerUserId: host.id,
    });

    // Host payable = 300 SAR
    expect((await balance(`HOST_PAYABLE:${host.id}`)).net).toBe(halalahsFromMajor('300'));
    // PSP clearing (asset) = 317.25 SAR received
    expect((await balance('PSP_CLEARING')).net).toBe(halalahsFromMajor('317.25'));
    // Platform revenue = 15 SAR (fee, VAT excluded)
    expect((await balance('PLATFORM_REVENUE')).net).toBe(halalahsFromMajor('15'));
    // VAT payable = 2.25 SAR
    expect((await balance('VAT_PAYABLE')).net).toBe(halalahsFromMajor('2.25'));
  });

  it('full refund fully reverses the capture ledger', async () => {
    const { booking, host } = await makeDailyRentalBooking({ grossMajor: '300' });
    const prisma = getPrisma();
    const quote = await computeQuote({
      transactionType: 'DAILY_RENTAL', propertyType: 'apartment',
      grossAmountHalalahs: booking.grossAmountHalalahs,
    });
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id, type: 'CHARGE',
        grossAmountHalalahs: quote.customerTotalHalalahs, currency: 'SAR',
        status: 'captured', provider: 'sandbox',
        idempotencyKey: 'idem-cap-2',
      },
    });
    await postCaptureEntries({
      paymentId: payment.id, bookingId: booking.id, quote,
      gatewayFeeHalalahs: 0n, hostUserId: host.id, ownerUserId: host.id,
    });
    const refund = await prisma.refund.create({
      data: {
        paymentId: payment.id, amountHalalahs: quote.customerTotalHalalahs, currency: 'SAR',
        status: 'completed', provider: 'sandbox', idempotencyKey: 'idem-ref-1',
      },
    });
    await postRefundEntries({
      refundId: refund.id, originalPaymentId: payment.id, originalQuote: quote,
      refundAmountHalalahs: quote.customerTotalHalalahs,
      hostUserId: host.id, ownerUserId: host.id,
    });

    expect((await balance(`HOST_PAYABLE:${host.id}`)).net).toBe(0n);
    expect((await balance('PSP_CLEARING')).net).toBe(0n);
    expect((await balance('PLATFORM_REVENUE')).net).toBe(0n);
    expect((await balance('VAT_PAYABLE')).net).toBe(0n);
  });

  it('partial refund reverses the proportional share', async () => {
    const { booking, host } = await makeDailyRentalBooking({ grossMajor: '300' });
    const prisma = getPrisma();
    const quote = await computeQuote({
      transactionType: 'DAILY_RENTAL', propertyType: 'apartment',
      grossAmountHalalahs: booking.grossAmountHalalahs,
    });
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id, type: 'CHARGE',
        grossAmountHalalahs: quote.customerTotalHalalahs, currency: 'SAR',
        status: 'captured', provider: 'sandbox', idempotencyKey: 'idem-cap-3',
      },
    });
    await postCaptureEntries({
      paymentId: payment.id, bookingId: booking.id, quote,
      gatewayFeeHalalahs: 0n, hostUserId: host.id, ownerUserId: host.id,
    });
    // Refund half.
    const half = quote.customerTotalHalalahs / 2n;
    const refund = await prisma.refund.create({
      data: {
        paymentId: payment.id, amountHalalahs: half, currency: 'SAR',
        status: 'completed', provider: 'sandbox', idempotencyKey: 'idem-ref-p',
      },
    });
    await postRefundEntries({
      refundId: refund.id, originalPaymentId: payment.id, originalQuote: quote,
      refundAmountHalalahs: half, hostUserId: host.id, ownerUserId: host.id,
    });
    // PSP is now holding ~half.
    const pspNet = (await balance('PSP_CLEARING')).net;
    expect(pspNet).toBe(quote.customerTotalHalalahs - half);
  });
});
