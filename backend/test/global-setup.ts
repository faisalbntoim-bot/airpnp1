import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

export default async function () {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'file:./test.db';
  const dbPath = resolve(process.cwd(), 'test.db');
  try { rmSync(dbPath); } catch {}
  try { rmSync(dbPath + '-journal'); } catch {}

  // Push the schema fresh into a clean sqlite file. `--skip-generate` because
  // the client is already generated once via `postinstall`.
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  });
}
