/**
 * Error tracker interface. Sentry / Rollbar / Bugsnag all fit this shape.
 *
 * The default implementation is a NO-OP so tests and dev builds don't need
 * an account. When SENTRY_DSN (or equivalent) is set in production, wire a
 * real implementation here — keep this interface unchanged so no route
 * code has to know which provider is behind it.
 *
 * IMPORTANT: never forward secrets, tokens, OTPs, or card data. Redaction
 * rules should mirror `logger.ts`'s REDACT_PATHS.
 */

export interface ErrorContext {
  requestId?: string;
  userId?: string;
  method?: string;
  path?: string;
  [key: string]: unknown;
}

export interface ErrorTracker {
  readonly name: string;
  captureException(err: unknown, context?: ErrorContext): Promise<void>;
  captureMessage(msg: string, context?: ErrorContext): Promise<void>;
}

/** No-op — used when SENTRY_DSN is empty. Never throws. */
export const noopErrorTracker: ErrorTracker = {
  name: 'noop',
  async captureException() { /* intentionally empty */ },
  async captureMessage() { /* intentionally empty */ },
};

// A cached instance. In production, replace at boot with a real one.
let current: ErrorTracker = noopErrorTracker;

export function setErrorTracker(t: ErrorTracker) { current = t; }
export const errorTracker: ErrorTracker = {
  get name() { return current.name; },
  captureException(err, ctx) { return current.captureException(err, ctx); },
  captureMessage(msg, ctx)   { return current.captureMessage(msg, ctx); },
};
