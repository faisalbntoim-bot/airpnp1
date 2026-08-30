/**
 * Settlement-retry worker.
 *
 * Picks FAILED settlements that are due for a retry and re-invokes the
 * payout via `requestPayout`. The payout call itself is idempotent per
 * settlement (`payout:<settlementId>` key at the provider layer + the
 * optimistic ELIGIBLE→PROCESSING lock inside `payout.ts`).
 *
 * Guarantees:
 *   - A settlement in PAID state is never re-paid.
 *   - `retryCount` monotonically increases; retries stop at MAX_RETRIES.
 *   - Backoff is exponential (5m × 2^retryCount) with a hard cap.
 *
 * INTENDED USE: cron every 15 minutes:
 *   *​/15 * * * *  node dist/workers/settlement-retry.js
 */

import { getPrisma } from '../db.js';
import { requestPayout } from '../financial/payout.js';

export interface SettlementRetryOptions {
  now?: Date;
  maxRetries?: number;
  baseBackoffMinutes?: number;
  maxBackoffMinutes?: number;
}

export interface SettlementRetryResult {
  scanned: number;
  retried: string[];       // settlement ids that were re-attempted this pass
  paid:    string[];       // settlement ids that finished as PAID
  failed:  string[];       // settlement ids that failed again
  skipped: string[];       // due but capped by retry limit
}

const MAX_RETRIES = 5;
const BASE_BACKOFF_MIN = 5;
const MAX_BACKOFF_MIN = 24 * 60;

/** Compute the earliest allowed retry moment for a given retry count. */
export function nextEligibleAt(lastRetryAt: Date | null, retryCount: number, base = BASE_BACKOFF_MIN, cap = MAX_BACKOFF_MIN): Date {
  const backoff = Math.min(base * Math.pow(2, retryCount), cap);
  const anchor = lastRetryAt ?? new Date(0);
  return new Date(anchor.getTime() + backoff * 60 * 1000);
}

export async function runSettlementRetrySweep(opts: SettlementRetryOptions = {}): Promise<SettlementRetryResult> {
  const prisma = getPrisma();
  const now = opts.now ?? new Date();
  const max = opts.maxRetries ?? MAX_RETRIES;

  const failed = await prisma.settlement.findMany({
    where: { status: 'FAILED' },
    orderBy: { updatedAt: 'asc' },
    take: 200,
  });

  const result: SettlementRetryResult = { scanned: failed.length, retried: [], paid: [], failed: [], skipped: [] };

  for (const s of failed) {
    if (s.retryCount >= max) { result.skipped.push(s.id); continue; }
    const due = nextEligibleAt(s.lastRetryAt, s.retryCount, opts.baseBackoffMinutes, opts.maxBackoffMinutes);
    if (due.getTime() > now.getTime()) continue;   // not due yet

    // Flip FAILED → ELIGIBLE so `requestPayout` can claim it.
    // (`requestPayout` requires ELIGIBLE; it enforces the optimistic lock.)
    const claim = await prisma.settlement.updateMany({
      where: { id: s.id, status: 'FAILED' },
      data: { status: 'ELIGIBLE' },
    });
    if (claim.count === 0) continue;   // another worker won

    try {
      const r = await requestPayout({ settlementId: s.id });
      if (r.status === 'PAID') result.paid.push(s.id);
      result.retried.push(s.id);
    } catch (err) {
      // Two failure paths:
      //  (a) requestPayout got past the ELIGIBLE→PROCESSING lock and the
      //      provider throw wrote FAILED + retryCount++ + lastRetryAt already.
      //  (b) requestPayout threw EARLY (KYC/payoutEnabled preconditions) and
      //      never reached the try/catch inside — the settlement is still
      //      ELIGIBLE. Write the failure state ourselves in that case.
      const after = await prisma.settlement.findUnique({ where: { id: s.id } });
      if (after && after.status !== 'FAILED') {
        await prisma.settlement.update({
          where: { id: s.id },
          data: {
            status: 'FAILED',
            failureReason: err instanceof Error ? err.message : 'retry failed',
            retryCount: { increment: 1 },
            lastRetryAt: new Date(),
          },
        });
      }
      result.failed.push(s.id);
      result.retried.push(s.id);
    }
  }

  return result;
}

const isEntry = process.argv[1] && (process.argv[1].endsWith('settlement-retry.js') || process.argv[1].endsWith('settlement-retry.ts'));
if (isEntry) {
  runSettlementRetrySweep()
    .then((r) => {
      // eslint-disable-next-line no-console
      console.log(`[settlement-retry] scanned=${r.scanned} retried=${r.retried.length} paid=${r.paid.length} failed=${r.failed.length} skipped=${r.skipped.length}`);
      process.exit(0);
    })
    .catch((err) => { console.error(err); process.exit(1); });
}
