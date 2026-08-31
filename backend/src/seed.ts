/**
 * Development seed.
 *
 *   npm run seed
 *
 * Seeds DB-driven CommissionRule + TaxRule + AdProduct + SubscriptionPlan rows
 * plus a small cast of users/properties so the API is usable from `curl`
 * immediately after `prisma migrate dev`.
 *
 * SAFE FOR DEV/TEST ONLY. Never run this against a production database.
 */

import { getPrisma } from './db.js';
import { halalahsFromMajor } from './money.js';

async function seed() {
  const prisma = getPrisma();

  // ---- Commission rules ---------------------------------------------------
  await prisma.commissionRule.upsert({
    where: { id: 'seed_cr_daily' },
    update: {},
    create: {
      id: 'seed_cr_daily',
      transactionType: 'DAILY_RENTAL',
      platformPercentage: 5,             // 5% of the rental
      officePercentage: null,            // Daily = customer → SakanHub → Host (no office/marketer)
      marketerPercentage: null,
      priority: 10,
    },
  });
  await prisma.commissionRule.upsert({
    where: { id: 'seed_cr_sale' },
    update: {},
    create: {
      id: 'seed_cr_sale',
      transactionType: 'SALE',
      platformPercentage: 2.5,           // typical brokerage
      officePercentage: 40,              // 40% of the platform fee to the office
      marketerPercentage: 10,            // 10% of the platform fee to the marketer
      priority: 10,
    },
  });
  await prisma.commissionRule.upsert({
    where: { id: 'seed_cr_longterm' },
    update: {},
    create: {
      id: 'seed_cr_longterm',
      transactionType: 'LONG_TERM_RENTAL',
      platformPercentage: 2,
      officePercentage: 30,
      marketerPercentage: 10,
      priority: 10,
    },
  });
  await prisma.commissionRule.upsert({
    where: { id: 'seed_cr_commercial' },
    update: {},
    create: {
      id: 'seed_cr_commercial',
      transactionType: 'COMMERCIAL_RENTAL',
      platformPercentage: 3,
      officePercentage: 30,
      marketerPercentage: 10,
      priority: 10,
    },
  });

  // ---- Tax rules ----------------------------------------------------------
  // Residential rent: EXEMPT per Saudi VAT (configurable — override with a
  // new active rule if the interpretation changes).
  await prisma.taxRule.upsert({
    where: { id: 'seed_tax_residential' },
    update: {},
    create: {
      id: 'seed_tax_residential',
      serviceType: 'RENTAL_RESIDENTIAL',
      ratePercent: 0,
      taxable: false,
      reasonCode: 'SA_VAT_RESIDENTIAL_EXEMPT',
    },
  });
  await prisma.taxRule.upsert({
    where: { id: 'seed_tax_commercial' },
    update: {},
    create: {
      id: 'seed_tax_commercial',
      serviceType: 'RENTAL_COMMERCIAL',
      ratePercent: 15,
      taxable: true,
    },
  });
  await prisma.taxRule.upsert({
    where: { id: 'seed_tax_platform_fee' },
    update: {},
    create: {
      id: 'seed_tax_platform_fee',
      serviceType: 'PLATFORM_FEE',
      ratePercent: 15,
      taxable: true,
    },
  });
  await prisma.taxRule.upsert({
    where: { id: 'seed_tax_brokerage' },
    update: {},
    create: { id: 'seed_tax_brokerage', serviceType: 'BROKERAGE', ratePercent: 15, taxable: true },
  });
  await prisma.taxRule.upsert({
    where: { id: 'seed_tax_ad' },
    update: {},
    create: { id: 'seed_tax_ad', serviceType: 'ADVERTISEMENT', ratePercent: 15, taxable: true },
  });
  await prisma.taxRule.upsert({
    where: { id: 'seed_tax_sub' },
    update: {},
    create: { id: 'seed_tax_sub', serviceType: 'SUBSCRIPTION', ratePercent: 15, taxable: true },
  });

  // ---- Ad products --------------------------------------------------------
  // Spec defaults for advertisement pricing — admin can override at any time
  // via POST /v1/admin/ad-products (nothing is hard-coded in engine code).
  for (const p of [
    { code: 'NORMAL',   nameAr: 'إعلان عادي',   priceMajor: '29',   durationDays: 30 },
    { code: 'FEATURED', nameAr: 'إعلان مميز',   priceMajor: '49',   durationDays: 30 },
    { code: 'PREMIUM',  nameAr: 'إعلان بريميوم', priceMajor: '99',  durationDays: 30 },
    { code: 'VIP',      nameAr: 'إعلان VIP',    priceMajor: '299',  durationDays: 30 },
  ] as const) {
    await prisma.adProduct.upsert({
      where: { code: p.code },
      update: {},
      create: {
        code: p.code, nameAr: p.nameAr,
        priceHalalahs: halalahsFromMajor(p.priceMajor),
        durationDays: p.durationDays, taxable: true, active: true,
      },
    });
  }

  // ---- Subscription plans -------------------------------------------------
  for (const s of [
    { code: 'INDIVIDUAL', nameAr: 'اشتراك فردي',    monthly: '29',   yearly: '299' },
    { code: 'MARKETER',   nameAr: 'اشتراك مسوّق',   monthly: '99',   yearly: '999' },
    { code: 'OFFICE',     nameAr: 'اشتراك مكتب',    monthly: '299',  yearly: '2999' },
    { code: 'ENTERPRISE', nameAr: 'اشتراك مؤسسة',   monthly: '999',  yearly: '9999' },
  ] as const) {
    await prisma.subscriptionPlan.upsert({
      where: { code: s.code },
      update: {},
      create: {
        code: s.code, nameAr: s.nameAr,
        monthlyHalalahs: halalahsFromMajor(s.monthly),
        yearlyHalalahs: halalahsFromMajor(s.yearly),
        trialDays: 0, taxable: true, active: true,
      },
    });
  }

  // ---- Test users + one daily-rental property ----------------------------
  const host = await prisma.user.upsert({
    where: { phone: '+966500000001' },
    update: {},
    create: { phone: '+966500000001', nameAr: 'محمد المضيف', email: 'host@example.test' },
  });
  const customer = await prisma.user.upsert({
    where: { phone: '+966500000002' },
    update: {},
    create: { phone: '+966500000002', nameAr: 'سارة العميلة', email: 'customer@example.test' },
  });
  const admin = await prisma.user.upsert({
    where: { phone: '+966500000099' },
    update: {},
    create: { phone: '+966500000099', nameAr: 'مدير النظام', email: 'admin@example.test' },
  });

  for (const [userId, role] of [
    [host.id, 'HOST'], [customer.id, 'CUSTOMER'], [admin.id, 'ADMIN'],
  ] as const) {
    await prisma.role.upsert({
      where: { userId_role_scope: { userId, role, scope: '' } },
      update: {},
      create: { userId, role, scope: '' },
    });
  }

  const property = await prisma.property.upsert({
    where: { listingNumber: 'SKN-0001' },
    update: {},
    create: {
      listingNumber: 'SKN-0001', ownerId: host.id, category: 'apartment', purpose: 'daily',
    },
  });
  await prisma.propertyHost.upsert({
    where: { propertyId_hostId: { propertyId: property.id, hostId: host.id } },
    update: {},
    create: { propertyId: property.id, hostId: host.id, isPrimary: true },
  });

  console.log('Seed complete:', { host: host.id, customer: customer.id, admin: admin.id, property: property.id });
}

seed()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
