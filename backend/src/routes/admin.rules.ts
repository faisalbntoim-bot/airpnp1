/**
 * Admin CRUD for the DB-driven rule tables.
 *
 * Never hard-code commission %, tax %, ad prices, or subscription prices in
 * source. Every value comes through these endpoints (ADMIN only) and is
 * versioned via effectiveFrom / effectiveTo.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '../db.js';
import { requireRole } from '../auth/rbac.js';
import { halalahsFromMajor, jsonSafe } from '../money.js';
import { audit } from '../audit.js';
import { notFound } from '../errors.js';

const commissionRuleSchema = z.object({
  transactionType: z.enum([
    'DAILY_RENTAL', 'LONG_TERM_RENTAL', 'COMMERCIAL_RENTAL', 'SALE',
    'ADVERTISEMENT', 'SUBSCRIPTION', 'SERVICE',
  ]),
  propertyType: z.string().nullish(),
  platformPercentage: z.number().min(0).max(100).nullish(),
  minimumFee: z.union([z.string(), z.number()]).nullish(),
  maximumFee: z.union([z.string(), z.number()]).nullish(),
  officePercentage: z.number().min(0).max(100).nullish(),
  marketerPercentage: z.number().min(0).max(100).nullish(),
  currency: z.string().length(3).default('SAR'),
  priority: z.number().int().default(100),
  active: z.boolean().default(true),
});

const taxRuleSchema = z.object({
  serviceType: z.enum([
    'RENTAL_RESIDENTIAL', 'RENTAL_COMMERCIAL', 'PLATFORM_FEE',
    'BROKERAGE', 'ADVERTISEMENT', 'SUBSCRIPTION', 'SALE',
  ]),
  transactionType: z.string().nullish(),
  ratePercent: z.number().min(0).max(100),
  taxable: z.boolean().default(true),
  reasonCode: z.string().nullish(),
  active: z.boolean().default(true),
});

const adProductSchema = z.object({
  code: z.enum(['NORMAL', 'FEATURED', 'PREMIUM', 'VIP']),
  nameAr: z.string(),
  nameEn: z.string().nullish(),
  price: z.union([z.string(), z.number()]),
  currency: z.string().length(3).default('SAR'),
  durationDays: z.number().int().positive(),
  taxable: z.boolean().default(true),
  active: z.boolean().default(true),
});

const subscriptionPlanSchema = z.object({
  code: z.enum(['INDIVIDUAL', 'MARKETER', 'OFFICE', 'ENTERPRISE']),
  nameAr: z.string(),
  nameEn: z.string().nullish(),
  monthly: z.union([z.string(), z.number()]),
  yearly: z.union([z.string(), z.number()]),
  trialDays: z.number().int().default(0),
  taxable: z.boolean().default(true),
  active: z.boolean().default(true),
});

export default async function adminRulesRoutes(app: FastifyInstance) {
  const adminOnly = requireRole(['ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN']);

  // Commission rules
  app.get('/v1/admin/commission-rules', async (req, reply) => {
    adminOnly(req, reply);
    const rows = await getPrisma().commissionRule.findMany({ orderBy: [{ transactionType: 'asc' }, { priority: 'asc' }] });
    return jsonSafe(rows);
  });
  app.post('/v1/admin/commission-rules', async (req, reply) => {
    const caller = adminOnly(req, reply);
    const body = commissionRuleSchema.parse(req.body);
    const created = await getPrisma().commissionRule.create({
      data: {
        transactionType: body.transactionType,
        propertyType: body.propertyType ?? null,
        platformPercentage: body.platformPercentage ?? null,
        minimumFeeHalalahs: body.minimumFee != null ? halalahsFromMajor(body.minimumFee) : null,
        maximumFeeHalalahs: body.maximumFee != null ? halalahsFromMajor(body.maximumFee) : null,
        officePercentage: body.officePercentage ?? null,
        marketerPercentage: body.marketerPercentage ?? null,
        currency: body.currency,
        priority: body.priority,
        active: body.active,
        createdBy: caller.userId,
      },
    });
    await audit({ actorId: caller.userId, action: 'RULE.CREATED', entity: 'CommissionRule', entityId: created.id, after: JSON.stringify(body) });
    return jsonSafe(created);
  });
  app.patch('/v1/admin/commission-rules/:id', async (req, reply) => {
    const caller = adminOnly(req, reply);
    const { id } = req.params as { id: string };
    const body = commissionRuleSchema.partial().parse(req.body);
    const existing = await getPrisma().commissionRule.findUnique({ where: { id } });
    if (!existing) throw notFound('rule not found');
    const updated = await getPrisma().commissionRule.update({
      where: { id },
      data: {
        transactionType: body.transactionType ?? undefined,
        propertyType: body.propertyType,
        platformPercentage: body.platformPercentage,
        minimumFeeHalalahs: body.minimumFee != null ? halalahsFromMajor(body.minimumFee) : undefined,
        maximumFeeHalalahs: body.maximumFee != null ? halalahsFromMajor(body.maximumFee) : undefined,
        officePercentage: body.officePercentage,
        marketerPercentage: body.marketerPercentage,
        currency: body.currency,
        priority: body.priority,
        active: body.active,
      },
    });
    await audit({ actorId: caller.userId, action: 'RULE.UPDATED', entity: 'CommissionRule', entityId: id, before: JSON.stringify(existing, (_k, v) => typeof v === 'bigint' ? v.toString() : v), after: JSON.stringify(body) });
    return jsonSafe(updated);
  });

  // Tax rules
  app.get('/v1/admin/tax-rules', async (req, reply) => {
    adminOnly(req, reply);
    return jsonSafe(await getPrisma().taxRule.findMany({ orderBy: [{ serviceType: 'asc' }] }));
  });
  app.post('/v1/admin/tax-rules', async (req, reply) => {
    const caller = adminOnly(req, reply);
    const body = taxRuleSchema.parse(req.body);
    const created = await getPrisma().taxRule.create({
      data: {
        serviceType: body.serviceType,
        transactionType: body.transactionType ?? null,
        ratePercent: body.ratePercent,
        taxable: body.taxable,
        reasonCode: body.reasonCode ?? null,
        active: body.active,
      },
    });
    await audit({ actorId: caller.userId, action: 'TAX.CREATED', entity: 'TaxRule', entityId: created.id });
    return jsonSafe(created);
  });

  // Ad products
  app.get('/v1/admin/ad-products', async (req, reply) => {
    adminOnly(req, reply);
    return jsonSafe(await getPrisma().adProduct.findMany({ orderBy: { code: 'asc' } }));
  });
  app.post('/v1/admin/ad-products', async (req, reply) => {
    const caller = adminOnly(req, reply);
    const body = adProductSchema.parse(req.body);
    const created = await getPrisma().adProduct.upsert({
      where: { code: body.code },
      update: {
        nameAr: body.nameAr, nameEn: body.nameEn ?? null,
        priceHalalahs: halalahsFromMajor(body.price), currency: body.currency,
        durationDays: body.durationDays, taxable: body.taxable, active: body.active,
      },
      create: {
        code: body.code,
        nameAr: body.nameAr, nameEn: body.nameEn ?? null,
        priceHalalahs: halalahsFromMajor(body.price), currency: body.currency,
        durationDays: body.durationDays, taxable: body.taxable, active: body.active,
      },
    });
    await audit({ actorId: caller.userId, action: 'AD_PRODUCT.UPSERTED', entity: 'AdProduct', entityId: created.id });
    return jsonSafe(created);
  });

  // Subscription plans
  app.get('/v1/admin/subscription-plans', async (req, reply) => {
    adminOnly(req, reply);
    return jsonSafe(await getPrisma().subscriptionPlan.findMany({ orderBy: { code: 'asc' } }));
  });
  app.post('/v1/admin/subscription-plans', async (req, reply) => {
    const caller = adminOnly(req, reply);
    const body = subscriptionPlanSchema.parse(req.body);
    const created = await getPrisma().subscriptionPlan.upsert({
      where: { code: body.code },
      update: {
        nameAr: body.nameAr, nameEn: body.nameEn ?? null,
        monthlyHalalahs: halalahsFromMajor(body.monthly),
        yearlyHalalahs: halalahsFromMajor(body.yearly),
        trialDays: body.trialDays, taxable: body.taxable, active: body.active,
      },
      create: {
        code: body.code,
        nameAr: body.nameAr, nameEn: body.nameEn ?? null,
        monthlyHalalahs: halalahsFromMajor(body.monthly),
        yearlyHalalahs: halalahsFromMajor(body.yearly),
        trialDays: body.trialDays, taxable: body.taxable, active: body.active,
      },
    });
    await audit({ actorId: caller.userId, action: 'PLAN.UPSERTED', entity: 'SubscriptionPlan', entityId: created.id });
    return jsonSafe(created);
  });
}
