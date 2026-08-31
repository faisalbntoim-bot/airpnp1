import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

export default async function () {
  process.env.NODE_ENV = 'test';
  // Honour a caller-supplied DATABASE_URL (e.g. the pg-smoke script). Only fall
  // back to the sqlite file when the caller did not set one.
  const injected = process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0
    ? process.env.DATABASE_URL
    : 'file:./test.db';
  process.env.DATABASE_URL = injected;

  if (injected.startsWith('file:')) {
    const dbPath = resolve(process.cwd(), 'test.db');
    try { rmSync(dbPath); } catch {}
    try { rmSync(dbPath + '-journal'); } catch {}
  }
  // Push the schema fresh. `--skip-generate` because the client is already
  // generated once via `postinstall`. `--accept-data-loss` is fine for a
  // scratch DB (either the just-rm'd sqlite file or the just-created PG DB).
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: injected },
  });
}
