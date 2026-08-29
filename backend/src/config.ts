import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.string().default('info'),
  TZ: z.string().default('Asia/Riyadh'),
  DEFAULT_CURRENCY: z.string().length(3).default('SAR'),

  DATABASE_URL: z.string().min(1).default('file:./dev.db'),

  PAYMENT_PROVIDER: z.enum(['sandbox', 'moyasar', 'tap']).default('sandbox'),

  MOYASAR_SECRET_KEY: z.string().optional().default(''),
  MOYASAR_WEBHOOK_SECRET: z.string().optional().default(''),
  TAP_SECRET_KEY: z.string().optional().default(''),
  TAP_WEBHOOK_SECRET: z.string().optional().default(''),

  JWT_SECRET: z.string().min(8).default('dev-only-change-me'),
  JWT_ISSUER: z.string().default('sakanhub-backend'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  DEFAULT_PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(100).default(5),
  DEFAULT_TAX_RATE_PERCENT: z.coerce.number().min(0).max(100).default(15),

  MONEY_ROUNDING: z.enum(['banker', 'half-up', 'half-down']).default('banker'),
});

export const config = schema.parse(process.env);
export type Config = typeof config;
