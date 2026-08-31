# SakanHub — Production Infrastructure Checklist

Status of everything the backend + iOS app depend on *outside* the
codebase. Nothing in this list can be marked ✅ from this container —
every item requires an external provider, DNS, or a signed contract.

Legend: ✅ Ready · ⚠️ Partial · ❌ Missing · 🔗 External-only

| Category | Item | Status | Notes / Required action |
|---|---|---|---|
| **Domain** | Register `sakanhub.com` (or final brand domain) | ❌ | Registrar (GoDaddy / Namecheap / SFDA-approved SA registrar) |
| Domain | `api.sakanhub.com` sub-domain | ❌ | Prod backend endpoint |
| Domain | `staging.sakanhub.com` | ❌ | |
| Domain | `admin.sakanhub.com` (optional) | ❌ | Admin console if separated |
| **DNS** | A/AAAA records → prod host | ❌ | Cloudflare / Route 53 |
| DNS | CAA record scoping to one CA | ❌ | Reduces mis-issuance risk |
| DNS | SPF/DKIM/DMARC on the domain | ❌ | Required for transactional email |
| **SSL/TLS** | Let's Encrypt or Cloudflare cert on `api.*` | ❌ | Auto-renew required |
| SSL/TLS | HSTS header on prod | ❌ | Add via reverse proxy (nginx / Cloudflare) |
| SSL/TLS | TLS 1.2+ only, disable RC4 / 3DES | ❌ | Cipher hardening |
| **Production API host** | Fly.io / Render / AWS / DigitalOcean droplet | ❌ | Node 22 + PM2 or systemd |
| Production API host | Auto-restart on OOM | ❌ | |
| Production API host | Health probe → `/healthz` | ❌ | |
| **Staging API host** | Separate host, same OS + image | ❌ | Never share with prod |
| **Database (prod)** | PostgreSQL 15+ managed service | ❌ | Supabase / Neon / RDS |
| Database (prod) | Migration path from SQLite dev → PG | ⚠️ | Prisma schema is portable; needs `provider = "postgresql"` swap + fresh migrate |
| Database (prod) | `foreign_keys=ON` NOT applicable to PG (native) | ✅ | PG enforces natively |
| Database (prod) | Row-level backups (WAL) | ❌ | Managed service default |
| **Database backups** | Daily automated snapshots | ❌ | Retention ≥ 30 days |
| Database backups | Off-site secondary copy | ❌ | Cross-region |
| Database backups | Restore drill (test at least once) | ❌ | |
| **Object storage** | S3-compatible bucket for property images, KYC docs, PDF invoices | ❌ | Cloudflare R2 / AWS S3 |
| Object storage | Private ACL by default | ❌ | Serve via signed URLs |
| Object storage | Server-side encryption at rest | ❌ | |
| **CDN** | Static images + built web assets | ❌ | Cloudflare / CloudFront |
| **SMS / OTP** | Unifonic / Twilio / Sinch account for KSA | ❌ | Required for `POST /v1/auth/otp` in prod (`src/auth/otp.ts:sendOtpSms`) |
| SMS / OTP | Sender-id + Ministry of Communications approval | ❌ | KSA regulator |
| SMS / OTP | Fallback provider | ⚠️ | Nice-to-have |
| **Email** | Transactional email provider (Postmark / SES) | ❌ | Account verification, receipts, refunds |
| Email | DKIM + return-path domain | ❌ | |
| **Push notifications** | APN key + APNs auth in App Store Connect | ❌ | Apple |
| Push notifications | Backend send channel | ❌ | Not yet implemented in backend |
| **Logging** | Central log aggregation (Loki / Datadog / CloudWatch) | ❌ | Retention ≥ 90 days |
| Logging | Log redaction ruleset (matches `src/logger.ts` list) | ⚠️ | Code redacts auth/idempotency headers |
| **Monitoring** | Uptime probe on `/healthz` from ≥ 3 regions | ❌ | UptimeRobot / Better Uptime |
| Monitoring | Prometheus/Grafana or hosted equivalent | ❌ | |
| Monitoring | Alerting rules: 5xx rate, webhook backlog, DB latency | ❌ | |
| **Error tracking** | Sentry backend project | ❌ | Node SDK, redaction ON |
| Error tracking | Sentry iOS project | ❌ | Swift SDK, tokens redacted |
| **Secrets management** | AWS Secrets Manager / Doppler / 1Password | ❌ | Never plain env in prod |
| Secrets management | Rotation policy for JWT + PSP secrets | ❌ | Document + calendar |
| **CI/CD** | GitHub Actions on push | ❌ | Node build + Vitest gate |
| CI/CD | Xcode Cloud (macOS runner) | ❌ | iOS build + Archive |
| CI/CD | Deploy pipeline to prod host | ❌ | Blue-green or rolling |
| **Rate limiting** | Fastify `@fastify/rate-limit` (200/min) | ✅ | In `src/main.ts` |
| Rate limiting | Prod tuning + exempt webhook | ⚠️ | Currently global — PSP burst may 429 |
| **CORS** | Origin whitelist | ❌ | Currently `origin: true` in `src/main.ts` — must lock to `https://app.sakanhub.com` in prod |
| **Reverse proxy** | nginx / Cloudflare in front | ❌ | Handles TLS + WAF + DDoS |
| **Backup verification** | Documented restore playbook | ❌ | |
| **Disaster recovery** | RTO / RPO targets | ❌ | Document + rehearse |

## Minimum viable production stack

Cheapest safe path (single AZ, no multi-region):
- Fly.io ($5–20/mo) for the Node backend
- Supabase Free / Pro ($25/mo) for Postgres + storage
- Cloudflare (free) for DNS + TLS + CDN
- Unifonic for KSA SMS (per-message billing)
- Sentry Team ($26/mo) for error tracking
- One `.env.production` in Doppler (free tier)
