/**
 * OTP service.
 *
 * - 6-digit numeric code, 5-minute TTL, max 5 verify attempts.
 * - Codes are stored ONLY as `sha256(salt + code)` — never the raw code.
 * - Per-phone rate limit: max 3 challenges in any rolling 10-minute window.
 * - Dev mode prints the code to the log ONCE so developers can complete the flow;
 *   production must wire a real SMS provider — see `sendOtpSms` below.
 * - Constant-time comparison on verify. On mismatch, `attempts` increments;
 *   when it reaches `maxAttempts` the challenge is invalidated even before expiry.
 */

import crypto from 'node:crypto';
import { getPrisma } from '../db.js';
import { badRequest, conflict, unauthorized } from '../errors.js';
import { config } from '../config.js';

const OTP_LENGTH = 6;
const OTP_TTL_SECONDS = 300;                       // 5 min
const MAX_ATTEMPTS = 5;
const MAX_REQUESTS_PER_WINDOW = 3;
const RATE_WINDOW_SECONDS = 600;                   // 10 min

export interface OtpRequestResult {
  requestId: string;
  expiresInSeconds: number;
}

function generateCode(): string {
  // Cryptographically-random 6-digit code; never Math.random.
  const buf = crypto.randomBytes(4);
  const n = buf.readUInt32BE(0) % 1_000_000;
  return n.toString().padStart(OTP_LENGTH, '0');
}

function hashCode(salt: string, code: string): string {
  return crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex');
}

/** Sends the OTP. In development it is logged; in production wire a real SMS provider here. */
async function sendOtpSms(phone: string, code: string): Promise<void> {
  if (config.NODE_ENV !== 'production') {
    // NEVER log OTPs in production. This branch is gated by NODE_ENV.
    console.log(`[otp] ${phone} → ${code} (dev)`);
    return;
  }
  // Wire an SMS provider (Unifonic / Twilio / Sinch) — do NOT throw here silently,
  // the caller assumes the OTP has been sent.
  throw new Error('OTP SMS provider not configured for production');
}

export async function requestOtp(phone: string): Promise<OtpRequestResult> {
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw badRequest('invalid phone (E.164 required)');
  const prisma = getPrisma();

  // Rate limit: 3 challenges per phone per 10 min (regardless of consumed state).
  const since = new Date(Date.now() - RATE_WINDOW_SECONDS * 1000);
  const recent = await prisma.otpChallenge.count({ where: { phone, createdAt: { gte: since } } });
  if (recent >= MAX_REQUESTS_PER_WINDOW) {
    throw conflict('too many OTP requests; try again later');
  }

  const code = generateCode();
  const salt = crypto.randomBytes(16).toString('hex');
  const codeHash = hashCode(salt, code);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

  const challenge = await prisma.otpChallenge.create({
    data: { phone, codeHash, salt, expiresAt, maxAttempts: MAX_ATTEMPTS },
  });

  await sendOtpSms(phone, code);

  return { requestId: challenge.id, expiresInSeconds: OTP_TTL_SECONDS };
}

/** Verifies the presented code and returns the phone on success. Throws on any failure. */
export async function verifyOtp(input: { requestId: string; code: string; phone: string }): Promise<{ phone: string }> {
  const prisma = getPrisma();
  const challenge = await prisma.otpChallenge.findUnique({ where: { id: input.requestId } });
  if (!challenge) throw unauthorized('invalid request');
  if (challenge.phone !== input.phone) throw unauthorized('invalid request');
  if (challenge.consumedAt) throw unauthorized('code already used');
  if (challenge.expiresAt.getTime() < Date.now()) throw unauthorized('code expired');
  if (challenge.attempts >= challenge.maxAttempts) throw unauthorized('too many attempts');

  const expected = hashCode(challenge.salt, input.code);
  const ok = crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(challenge.codeHash, 'hex'));
  if (!ok) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    throw unauthorized('invalid code');
  }

  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });
  return { phone: challenge.phone };
}
