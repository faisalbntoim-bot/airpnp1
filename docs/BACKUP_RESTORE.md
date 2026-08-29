# SakanHub — Database Backup & Restore Runbook

Applies to production Postgres. Development SQLite is not backed up — the
seed script rebuilds it on demand.

## Storage engine

- Production: PostgreSQL 15+ (managed service — Supabase / Neon / RDS).
- Development: SQLite via Prisma's `file:` provider.

The Prisma schema is portable: switching `datasource db.provider` from
`sqlite` to `postgresql` and pointing `DATABASE_URL` at a Postgres cluster
is a supported migration path. Do this ONCE per environment before the
first prod deploy.

## What must be backed up

| Object | Included by full snapshot? | Notes |
|---|---|---|
| All tables (Prisma-managed) | ✅ | Financial + auth + operational |
| Migration history (`_prisma_migrations`) | ✅ | |
| Sequences | ✅ | Cuid ids don't need sequences, but any future auto-increment relies on them |
| Extensions (pgcrypto etc.) | ✅ | Whatever the managed service ships |
| Backend `.env` (secrets) | ❌ | Lives in Doppler / AWS SM — backed up separately |
| Object storage (media / KYC docs / invoices) | ❌ | Backed up by the storage provider's own snapshots |

## Cadence

| Frequency | What | Retention |
|---|---|---|
| Continuous (WAL) | Point-in-time recovery | 7 days |
| Daily | Full snapshot | 30 days |
| Weekly | Full snapshot to cross-region cold storage | 90 days |
| Monthly | Long-term archive (S3 Glacier / equivalent) | 7 years — Saudi tax law requires 10 years for financial records; we keep DB backups at 7 and rely on the immutable Ledger + Invoice tables for the balance |

## Backup — using the managed service

Most managed Postgres providers do this for you automatically. Verify:
1. Automated daily backups are enabled.
2. Retention meets or exceeds the cadence above.
3. Point-in-time recovery window is at least 7 days.
4. A cross-region secondary is provisioned (or the primary region has multi-AZ).

## Manual backup (defence in depth)

Run from a machine with `psql` + `pg_dump` installed and network access to
the primary. The connection string lives in the secrets manager — do NOT
paste it into shell history.

```bash
export PGPASSWORD=$(doppler secrets get DATABASE_PASSWORD --plain)
pg_dump \
  --host="$PGHOST" \
  --username="$PGUSER" \
  --dbname="$PGDATABASE" \
  --format=custom \
  --file="sakanhub-$(date -u +%Y%m%dT%H%M%SZ).dump" \
  --no-owner --no-privileges --clean --if-exists
```

Upload the resulting `.dump` to the off-site cold store immediately; keep
only the encrypted copy long-term.

## Restore drill (rehearse quarterly)

**Never restore into the production cluster without a rehearsed procedure.**

1. Provision a fresh staging Postgres instance.
2. Fetch the most recent dump you plan to restore from cold storage.
3. Reset the target:
   ```bash
   psql "$STAGING_URL" -c "DROP DATABASE IF EXISTS sakanhub; CREATE DATABASE sakanhub;"
   ```
4. Restore:
   ```bash
   pg_restore --host="$PGHOST" --username="$PGUSER" --dbname=sakanhub \
     --no-owner --no-privileges --exit-on-error sakanhub-…dump
   ```
5. Apply any migrations newer than the backup:
   ```bash
   DATABASE_URL="$STAGING_URL" npx prisma migrate deploy
   ```
6. Smoke-test:
   - Run `npm test` against a copy of production data (redact PII first).
   - Verify `SELECT count(*) FROM "LedgerEntry"` matches the last known good.
   - Verify `SELECT count(*) FROM "Invoice"` matches.
   - Verify the sum of `PLATFORM_REVENUE` credits equals the sum of platform-fee
     debits (double-entry invariant).

## Post-restore checklist

- Rotate `JWT_SECRET` (old refresh tokens become invalid → force-logout is intentional).
- Rotate the DB password if the leak was suspected.
- Update DNS to point `api.sakanhub.com` at the restored instance (only after smoke tests).
- Post an incident summary in the ops channel.

## RTO / RPO targets (draft — approve with ops lead)

| Metric | Target |
|---|---|
| RPO (recovery point objective) | 1 hour (via WAL PITR) |
| RTO (recovery time objective) | 4 hours (from decision to production traffic served) |

## Do NOT

- Do NOT restore directly onto the primary cluster.
- Do NOT restore into a production DB using a laptop as the client — use a hardened bastion.
- Do NOT log the connection string (`git log -p` on `.env` history should return zero).
