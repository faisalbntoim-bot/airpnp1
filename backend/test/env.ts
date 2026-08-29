// Runs once per test worker BEFORE modules are imported.
// Keep test DB isolated from the dev DB.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./test.db';
process.env.PAYMENT_PROVIDER = 'sandbox';
process.env.MONEY_ROUNDING = process.env.MONEY_ROUNDING || 'banker';
process.env.DEFAULT_PLATFORM_FEE_PERCENT = process.env.DEFAULT_PLATFORM_FEE_PERCENT || '5';
process.env.DEFAULT_TAX_RATE_PERCENT = process.env.DEFAULT_TAX_RATE_PERCENT || '15';
