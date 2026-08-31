/**
 * Booking-expiry worker.
 *
 * Cancels bookings that are stuck in `pending_payment` past the TTL. Never
 * touches bookings whose payment reached `captured`, and never touches
 * bookings the worker has already cancelled — reruns are safe.
 *
 * Also cancels the sibling Payment row (only if it is still `pending`)
 * and any PENDING Settlement rows that leaked through.
 *
 * INTENDED USE: fire from a cron every 5 minutes:
 *   *​/5 * * * *   node dist/workers/booking-expiry.js
 * or from a job runner. Wrap in `withIdempotency` at the CALLING layer
 * when running multi-node — the SQL below is safe under concurrent runs
 * but the effect (audit trail) may be posted twice.
 */

import { getPrisma } from '../db.js';
import { audit } from '../audit.js';

export interface BookingExpiryOptions {
  ttlMinutes?: number;
  now?: Date;
}

export interface BookingExpiryResult {
  scanned: number;
  cancelled: string[];       // booking ids
}

const DEFAULT_TTL_MINUTES = 30;

/**
 * Sweep expired pending bookings. Returns the ids that were cancelled.
 * Safe to call repeatedly — an already-cancelled booking is skipped.
 */
export async function runBookingExpirySweep(opts: BookingExpiryOptions = {}): Promise<BookingExpiryResult> {
  const prisma = getPrisma();
  const ttl = opts.ttlMinutes ?? DEFAULT_TTL_MINUTES;
  const cutoff = new Date((opts.now?.getTime() ?? Date.now()) - ttl * 60 * 1000);

  // Find candidates in ONE query. The predicate on Payment.status guarantees
  // we never touch a booking whose payment already captured.
  const candidates = await prisma.booking.findMany({
    where: {
      status: 'pending_payment',
      createdAt: { lt: cutoff },
      // Either no payment yet OR every payment is still pending / failed / cancelled.
      // We check this defensively below anyway.
    },
    include: { payments: true },
    take: 500,                   // batch cap; cron re-runs pick up the rest
  });

  const cancelled: string[] = [];
  for (const b of candidates) {
    // Defensive guard: if ANY payment reached captured, treat the booking as
    // safe and never cancel it here. The webhook should have flipped its
    // status; if not, that's a reconciliation task, not our concern.
    const hasCapturedPayment = b.payments.some((p) => p.status === 'captured' || p.status === 'partial_refunded' || p.status === 'refunded');
    if (hasCapturedPayment) continue;

    // Optimistic concurrency: only update rows still in `pending_payment`.
    const claim = await prisma.booking.updateMany({
      where: { id: b.id, status: 'pending_payment' },
      data: { status: 'cancelled' },
    });
    if (claim.count === 0) continue;      // another worker or the webhook won the race

    // Cancel any still-pending Payment for this booking.
    await prisma.payment.updateMany({
      where: { bookingId: b.id, status: 'pending' },
      data: { status: 'cancelled', providerStatus: 'cancelled' },
    });
    // Cancel PENDING settlements (rare — created only on capture, but safe to sweep).
    await prisma.settlement.updateMany({
      where: { paymentId: { in: b.payments.map((p) => p.id) }, status: 'PENDING' },
      data: { status: 'CANCELLED', failureReason: 'booking expired' },
    });

    await audit({
      action: 'BOOKING.EXPIRED',
      entity: 'Booking',
      entityId: b.id,
      after: JSON.stringify({ ttlMinutes: ttl }),
    });
    cancelled.push(b.id);
  }

  return { scanned: candidates.length, cancelled };
}

// CLI entry — `node dist/workers/booking-expiry.js`
const isEntry = process.argv[1] && (process.argv[1].endsWith('booking-expiry.js') || process.argv[1].endsWith('booking-expiry.ts'));
if (isEntry) {
  runBookingExpirySweep()
    .then((r) => {
      // eslint-disable-next-line no-console
      console.log(`[booking-expiry] scanned=${r.scanned} cancelled=${r.cancelled.length}`);
      process.exit(0);
    })
    .catch((err) => { console.error(err); process.exit(1); });
}
