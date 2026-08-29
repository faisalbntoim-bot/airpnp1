import crypto from 'node:crypto';
import { getPrisma } from './db.js';
import { conflict } from './errors.js';

/**
 * Idempotency guard.
 *
 *   const result = await withIdempotency({ key, scope, requestBody }, async () => {
 *     // do the work
 *     return response;
 *   });
 *
 * A retried request with the same `Idempotency-Key` and matching body hash
 * returns the memoised response instead of re-running the work.
 * A key with a different body hash is rejected as a conflict.
 */
export async function withIdempotency<T>(args: {
  key: string;
  scope: string;
  requestBody: unknown;
}, work: () => Promise<T>): Promise<T> {
  const prisma = getPrisma();
  const requestHash = sha256(JSON.stringify(args.requestBody ?? {}));

  // Fast path: memoised
  const existing = await prisma.idempotencyKey.findUnique({ where: { key: args.key } });
  if (existing) {
    if (existing.scope !== args.scope || existing.requestHash !== requestHash) {
      throw conflict('idempotency key was used with a different request');
    }
    if (existing.status === 'completed' && existing.responseJson) {
      return JSON.parse(existing.responseJson) as T;
    }
    if (existing.status === 'in_flight') {
      throw conflict('previous request with this key is still in flight');
    }
    if (existing.status === 'failed') {
      throw conflict('previous request with this key failed; use a new key to retry');
    }
  }

  // Reserve the key
  await prisma.idempotencyKey.create({
    data: { key: args.key, scope: args.scope, requestHash, status: 'in_flight' },
  });

  try {
    const result = await work();
    await prisma.idempotencyKey.update({
      where: { key: args.key },
      data: {
        status: 'completed',
        responseJson: JSON.stringify(result, (_, v) => typeof v === 'bigint' ? v.toString() : v),
        completedAt: new Date(),
      },
    });
    return result;
  } catch (err) {
    await prisma.idempotencyKey.update({
      where: { key: args.key },
      data: { status: 'failed', completedAt: new Date() },
    });
    throw err;
  }
}

export function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
