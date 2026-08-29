/**
 * SakanHub backend entrypoint.
 *
 * Boots Fastify, wires routes, installs the AppError -> HTTP mapper.
 * SECURITY: `x-user-id`/`x-user-role` headers are trusted here for local
 * development ONLY. In production, place this behind an auth gateway that
 * verifies JWT / OTP tokens and forwards the verified claims.
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { config } from './config.js';
import { loggerOptions } from './logger.js';
import { AppError } from './errors.js';
import bookingRoutes from './routes/bookings.js';
import paymentRoutes from './routes/payments.js';
import webhookRoutes from './routes/webhook.js';
import refundRoutes from './routes/refunds.js';
import walletRoutes from './routes/wallet.js';
import invoiceRoutes from './routes/invoices.js';
import adminRulesRoutes from './routes/admin.rules.js';
import adminReportRoutes from './routes/admin.reports.js';
import beneficiaryRoutes from './routes/beneficiaries.js';

export async function buildServer() {
  const app = Fastify({ logger: loggerOptions, disableRequestLogging: config.NODE_ENV === 'test' });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(rateLimit, { max: 200, timeWindow: '1 minute' });

  app.get('/healthz', async () => ({ ok: true, env: config.NODE_ENV }));

  // Webhook is registered as its own plugin scope so its rawBody parser stays local.
  await app.register(async (scope) => {
    await scope.register(webhookRoutes);
  });

  await app.register(bookingRoutes);
  await app.register(paymentRoutes);
  await app.register(refundRoutes);
  await app.register(walletRoutes);
  await app.register(invoiceRoutes);
  await app.register(adminRulesRoutes);
  await app.register(adminReportRoutes);
  await app.register(beneficiaryRoutes);

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.httpStatus).send({ error: err.code, message: err.message, details: err.details });
    }
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: 'VALIDATION', issues: err.issues });
    }
    req.log.error({ err }, 'unhandled error');
    return reply.code(500).send({ error: 'INTERNAL', message: 'internal server error' });
  });

  return app;
}

// Allow `node dist/main.js` to boot the server directly.
const isEntry = process.argv[1] && (process.argv[1].endsWith('main.js') || process.argv[1].endsWith('main.ts'));
if (isEntry) {
  buildServer()
    .then((app) => app.listen({ port: config.PORT, host: '0.0.0.0' }))
    .then((addr) => console.log(`sakanhub backend listening on ${addr}`))
    .catch((err) => { console.error(err); process.exit(1); });
}
