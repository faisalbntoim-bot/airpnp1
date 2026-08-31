import { config } from './config.js';

/**
 * Redaction paths — anything that could carry a secret / token / OTP / KYC
 * material MUST live here. We treat these as write-once; adding more is easy,
 * removing anything requires a security review.
 */
const REDACT_PATHS = [
  // Auth
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-user-id"]',
  'req.headers["x-user-role"]',
  'req.headers["idempotency-key"]',
  // Provider webhook signatures (secret-shared)
  'req.headers["x-sandbox-signature"]',
  'req.headers["x-moyasar-signature"]',
  'req.headers["x-tap-signature"]',
  // JWT / refresh in bodies (should never travel in the body, but redact defensively)
  '*.accessToken',
  '*.refreshToken',
  '*.jwt',
  // OTP / codes
  '*.otp',
  '*.code',
  // Card / IBAN — should never reach us, but defensive
  '*.card',
  '*.pan',
  '*.cvv',
  '*.iban',
];

export const loggerOptions =
  config.NODE_ENV === 'test'
    ? false
    : {
        level: config.LOG_LEVEL,
        redact: { paths: REDACT_PATHS, censor: '[redacted]' },
        // pino's built-in serializer includes the request id, which the server
        // populated from `x-request-id` (or generated a fresh cuid/uuid).
      };
