# SakanHub — Environment Variables

Complete reference for every variable read by the backend or the iOS app,
per environment.

**NO SECRET VALUES ARE STORED IN THIS FILE.** Real values live only in the
secrets manager (Doppler / AWS Secrets Manager / 1Password). Every value
below is either a shape / example / non-secret default.

## Backend (Node / Fastify)

Loaded via `src/config.ts` (Zod-validated). Missing values fall back to
schema defaults where safe; unsafe defaults (e.g. `JWT_SECRET`) refuse to
boot in prod.

| Variable | Development | Staging | Production | Notes |
|---|---|---|---|---|
| `NODE_ENV` | `development` | `staging` (mapped to `production`) | `production` | Gates RBAC dev-header fallback |
| `PORT` | `4000` | `4000` | `4000` (behind proxy) | |
| `LOG_LEVEL` | `info` | `info` | `warn` | pino level |
| `TZ` | `Asia/Riyadh` | `Asia/Riyadh` | `Asia/Riyadh` | |
| `DEFAULT_CURRENCY` | `SAR` | `SAR` | `SAR` | |
| `DATABASE_URL` | `file:./dev.db` | `postgresql://…staging…` | `postgresql://…prod…` | **SECRET in staging/prod** |
| `PAYMENT_PROVIDER` | `sandbox` | `tap` or `moyasar` (sandbox creds) | `tap` or `moyasar` | Selects the adapter |
| `MOYASAR_SECRET_KEY` | *(empty)* | *(sandbox key)* | *(prod key)* | **SECRET** — never in iOS |
| `MOYASAR_WEBHOOK_SECRET` | *(empty)* | *(sandbox)* | *(prod)* | **SECRET** — HMAC of webhook body |
| `TAP_SECRET_KEY` | *(empty)* | *(sandbox)* | *(prod)* | **SECRET** — never in iOS |
| `TAP_WEBHOOK_SECRET` | *(empty)* | *(sandbox)* | *(prod)* | **SECRET** |
| `TAP_BASE_URL` | `https://api.tap.company` | *(sandbox host)* | `https://api.tap.company` | |
| `JWT_SECRET` | `dev-only-change-me` | *(random 32-byte hex)* | *(random 32-byte hex)* | **SECRET** — rotate on compromise |
| `JWT_ISSUER` | `sakanhub-backend` | `sakanhub-backend` | `sakanhub-backend` | |
| `JWT_EXPIRES_IN` | `7d` | `15m` (access) | `15m` (access) | Refresh is 30d, hashed in DB |
| `DEFAULT_PLATFORM_FEE_PERCENT` | `5` | `5` | `5` | Fallback only when no CommissionRule matches |
| `DEFAULT_TAX_RATE_PERCENT` | `15` | `15` | `15` | Fallback only when no TaxRule matches |
| `MONEY_ROUNDING` | `banker` | `banker` | `banker` | banker / half-up / half-down |

Refuse-to-boot invariants for prod (implement in a deploy pre-check):
- `JWT_SECRET` must be > 32 chars and not the default
- `DATABASE_URL` must start with `postgresql://` (not `file:`)
- `PAYMENT_PROVIDER` != `sandbox`
- Corresponding `<PROVIDER>_SECRET_KEY` non-empty
- Corresponding `<PROVIDER>_WEBHOOK_SECRET` non-empty

## iOS (via xcconfig → Info.plist substitution)

Loaded by `AppEnvironment.swift` (Info.plist → typed accessors).

| Variable | Development | Staging | Production | Notes |
|---|---|---|---|---|
| `API_BASE_URL` | `http://localhost:4000` | `https://staging.sakanhub.example` | `https://api.sakanhub.example` | **PRODUCTION build asserts HTTPS** |
| `USE_MOCKS` | `YES` | `NO` | `NO` | Prod build ignores this — `PRODUCTION` compile flag hard-forces `false` |
| (Compile flag) `DEBUG` | on | off | off | |
| (Compile flag) `STAGING` | off | on | off | |
| (Compile flag) `PRODUCTION` | off | off | on | |

**Absolute rules for iOS:**
- ❌ No PSP secret ever in Info.plist / xcconfig / source
- ❌ No `JWT_SECRET` on the device (only the issued *token* is stored, in Keychain)
- ❌ No admin credentials
- ❌ No third-party API keys with server-side scope (Maps public keys OK, PSP secrets NOT)

## Verification (already automated / can automate)

- ✅ `git grep -E 'sk_(test|live)|pk_(test|live)|TAP_SECRET|MOYASAR_SECRET'` — zero hits on this branch
- ⚠️ Recommended: add a pre-commit hook via `gitleaks` or `trufflehog`
- ⚠️ Recommended: GitHub Actions secret-scan on push

## Rotation policy (draft — approve with security lead)

| Key | Rotate every | On compromise |
|---|---|---|
| `JWT_SECRET` | 90 days | Immediately + force-logout all users |
| `<PROVIDER>_SECRET_KEY` | 12 months | Immediately + reissue via PSP dashboard |
| `<PROVIDER>_WEBHOOK_SECRET` | 12 months | Immediately + update webhook signing on PSP |
| Database password | 90 days | Immediately + rotate via managed service |
| S3 access keys | 90 days | Immediately + revoke |
