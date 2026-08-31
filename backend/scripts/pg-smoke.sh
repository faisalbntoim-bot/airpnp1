#!/usr/bin/env bash
#
# Postgres smoke test.
#
# Boots the Prisma schema against a REAL Postgres instance (not SQLite),
# runs the full test suite, then restores the schema. Fails fast on any
# step. Safe to re-run — the target DB is dropped & recreated.
#
# Prereqs on the box:
#   - Postgres 14+ running locally (pg_isready must succeed)
#   - postgres role has createdb + password matching PGPASSWORD below
#   - Node + npm + npx prisma
#
# Environment override (optional):
#   PG_URL   default = postgresql://postgres:sakanhub_dev@127.0.0.1:5432/sakanhub_smoke
set -euo pipefail

PG_URL="${PG_URL:-postgresql://postgres:sakanhub_dev@127.0.0.1:5432/sakanhub_smoke}"
BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCHEMA="$BASE_DIR/prisma/schema.prisma"
BACKUP="$SCHEMA.sqlite.bak"

trap 'restore' EXIT
restore() {
    if [ -f "$BACKUP" ]; then
        mv "$BACKUP" "$SCHEMA"
        # Regenerate the client with the sqlite provider so subsequent
        # `npm test` runs see the correct binary.
        (cd "$BASE_DIR" && DATABASE_URL="file:./dev.db" npx prisma generate >/dev/null 2>&1) || true
        echo "[pg-smoke] schema + client restored to sqlite"
    fi
}

echo "[pg-smoke] target = $PG_URL"

# 1. verify Postgres is reachable
if ! pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
    echo "[pg-smoke] Postgres not reachable on 127.0.0.1:5432 — start it first" >&2
    exit 1
fi

# 2. reset the smoke DB
psql "postgresql://postgres:sakanhub_dev@127.0.0.1:5432/postgres" -v ON_ERROR_STOP=1 <<SQL >/dev/null
DROP DATABASE IF EXISTS sakanhub_smoke;
CREATE DATABASE sakanhub_smoke;
SQL

# 3. swap the schema's provider to postgresql (in place, reverted by trap)
cp "$SCHEMA" "$BACKUP"
sed -i 's/provider = "sqlite"/provider = "postgresql"/' "$SCHEMA"

# 4. regenerate the Prisma client with provider=postgresql (the runtime
#    client is baked at generate time; the sqlite version rejects a pg URL)
cd "$BASE_DIR"
DATABASE_URL="$PG_URL" npx prisma generate
DATABASE_URL="$PG_URL" npx prisma db push --skip-generate --accept-data-loss

# 5. run the full suite against Postgres
DATABASE_URL="$PG_URL" \
NODE_ENV=test \
PAYMENT_PROVIDER=sandbox \
MONEY_ROUNDING=banker \
DEFAULT_PLATFORM_FEE_PERCENT=5 \
DEFAULT_TAX_RATE_PERCENT=15 \
npx vitest run --pool=forks --poolOptions.forks.singleFork=true

echo "[pg-smoke] all tests passed on Postgres"
