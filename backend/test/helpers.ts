import { getPrisma, disconnect } from '../src/db.js';
import { halalahsFromMajor } from '../src/money.js';

export async function resetDb() {
  const prisma = getPrisma();
  // Order matters: children first.
  await prisma.$transaction([
    prisma.ledgerEntry.deleteMany(),
    prisma.account.deleteMany(),
    prisma.paymentEvent.deleteMany(),
    prisma.refund.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.settlement.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.webhookEvent.deleteMany(),
    prisma.bookingItem.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.propertyHost.deleteMany(),
    prisma.property.deleteMany(),
    prisma.beneficiary.deleteMany(),
    prisma.role.deleteMany(),
    prisma.kyc.deleteMany(),
    prisma.user.deleteMany(),
    prisma.commissionRule.deleteMany(),
    prisma.taxRule.deleteMany(),
    prisma.adProduct.deleteMany(),
    prisma.subscriptionPlan.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.advertisement.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.idempotencyKey.deleteMany(),
    prisma.taxRecord.deleteMany(),
  ]);
}

export async function seedRules() {
  const prisma = getPrisma();
  await prisma.commissionRule.create({
    data: { transactionType: 'DAILY_RENTAL', platformPercentage: 5, priority: 10 },
  });
  await prisma.commissionRule.create({
    data: { transactionType: 'SALE', platformPercentage: 2.5, officePercentage: 40, marketerPercentage: 10, priority: 10 },
  });
  await prisma.commissionRule.create({
    data: { transactionType: 'COMMERCIAL_RENTAL', platformPercentage: 3, officePercentage: 30, marketerPercentage: 10, priority: 10 },
  });

  await prisma.taxRule.create({ data: { serviceType: 'RENTAL_RESIDENTIAL', ratePercent: 0, taxable: false, reasonCode: 'SA_VAT_RESIDENTIAL_EXEMPT' } });
  await prisma.taxRule.create({ data: { serviceType: 'RENTAL_COMMERCIAL', ratePercent: 15, taxable: true } });
  await prisma.taxRule.create({ data: { serviceType: 'PLATFORM_FEE', ratePercent: 15, taxable: true } });
  await prisma.taxRule.create({ data: { serviceType: 'BROKERAGE', ratePercent: 15, taxable: true } });
}

export async function makeUsers() {
  const prisma = getPrisma();
  const host = await prisma.user.create({ data: { phone: '+9660001', nameAr: 'مضيف' } });
  const customer = await prisma.user.create({ data: { phone: '+9660002', nameAr: 'عميل' } });
  return { host, customer };
}

export async function makeDailyRentalBooking(opts: { grossMajor: string | number }) {
  const prisma = getPrisma();
  const { host, customer } = await makeUsers();
  const property = await prisma.property.create({
    data: { listingNumber: `L-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ownerId: host.id, category: 'apartment', purpose: 'daily' },
  });
  await prisma.propertyHost.create({ data: { propertyId: property.id, hostId: host.id, isPrimary: true } });
  const booking = await prisma.booking.create({
    data: {
      propertyId: property.id,
      customerId: customer.id,
      hostId: host.id,
      transactionType: 'DAILY_RENTAL',
      grossAmountHalalahs: halalahsFromMajor(opts.grossMajor),
      currency: 'SAR',
      status: 'draft',
    },
  });
  return { host, customer, property, booking };
}

export async function shutdown() {
  await disconnect();
}
