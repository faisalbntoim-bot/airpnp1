import { config } from './config.js';

export const loggerOptions =
  config.NODE_ENV === 'test'
    ? false
    : {
        level: config.LOG_LEVEL,
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-user-id"]',
            'req.headers["x-user-role"]',
            'req.headers["idempotency-key"]',
            'req.headers["x-sandbox-signature"]',
          ],
          censor: '[redacted]',
        },
      };
