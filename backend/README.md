# SakanHub — Financial Engine backend

Node.js + TypeScript + Fastify + Prisma + Zod + Vitest.

This module lives inside the SakanHub repo (does NOT replace the iOS or web
front-ends). It implements the money-side of the platform: pricing, VAT,
commissions, ledger, payments, refunds, settlements, invoicing, and admin
reporting.

## Non-negotiables (baked into the code)

- **Money is `BigInt` halalahs** everywhere. Never floats — see `src/money.ts`.
- **All commission %, tax %, ad prices, plan prices come from the DB**
  (`CommissionRule`, `TaxRule`, `AdProduct`, `SubscriptionPlan`).
  Nothing is hard-coded — the code only reads `DEFAULT_PLATFORM_FEE_PERCENT`
  and `DEFAULT_TAX_RATE_PERCENT` from env as *fallbacks* that admins can override.
- **Double-entry ledger** with an immutability rule: refunds insert reverse
  entries, they never modify or delete existing ones.
- **Idempotency** on every write endpoint via `Idempotency-Key` header +
  `IdempotencyKey` table (request-body hash validated).
- **Webhook security**: HMAC signature verified against the provider secret,
  duplicate `(provider, externalEventId)` events acked without re-processing.
- **No card data in our DB.** PSP tokens only. Payment secrets stay in env
  and never leave the server. Never trust the client for "paid" — only a
  verified webhook (or a signed server-side verify) captures a payment.
- **VAT is a liability, not revenue.** `PLATFORM_REVENUE` is credited with
  `platformFee - officeShare - marketerShare`; `VAT_PAYABLE` gets the tax.
- **Residential rent is EXEMPT** by default (SA VAT, ZATCA guidance). This
  is a rule, not a hard-code — overridable via `/v1/admin/tax-rules`.
- **ZATCA Fatoora Phase 2**: invoice shape is UBL-compatible but the signed
  XML / QR is a stub. Do not claim ZATCA compliance until a real adapter is
  wired.

## Financial rules (Daily Rental — spec)

- Flow: Customer → SakanHub → Host (no office, no marketer)
- 300 SAR rent → platform fee 5% (15 SAR) → VAT on the fee 15% (2.25 SAR)
  → customer pays **317.25 SAR** → host receives the full **300 SAR**.

The tests cover 29, 40, 100, 300, 500, 1000, 5000, 100000 and 1000000 SAR.

## Getting started

```bash
cd backend
cp .env.example .env               # never commit real secrets
npm install
npm run prisma:generate
npm run prisma:migrate             # creates dev.db
npm run seed                       # seeds rules + sample users
npm run dev                        # http://localhost:4000
```

## HTTP surface

All handlers require an `x-user-id` + `x-user-role` header (dev-only auth —
put a real gateway in front in production). Admin endpoints require role
`ADMIN`.

- `GET  /healthz`
- `POST /v1/bookings`
- `GET  /v1/bookings/:id`
- `POST /v1/quote`                             — preview a quote without booking
- `POST /v1/payments`                          — start checkout (idempotent)
- `GET  /v1/payments/:id`
- `POST /v1/payments/webhook`                  — PSP webhook (HMAC-verified)
- `POST /v1/payments/:id/refund`               — full or partial (idempotent)
- `GET  /v1/wallet`                            — per-role payable balances
- `GET  /v1/settlements`
- `GET  /v1/transactions`                      — ledger view for the caller
- `GET  /v1/invoices/:id`
- `GET/POST/PATCH /v1/admin/commission-rules`
- `GET/POST       /v1/admin/tax-rules`
- `GET/POST       /v1/admin/ad-products`
- `GET/POST       /v1/admin/subscription-plans`
- `GET            /v1/admin/overview?from=…&to=…`

## Payment providers

`PAYMENT_PROVIDER` env selects the adapter:

- `sandbox` — deterministic in-memory PSP for dev + tests
  (`simulateCapture`, `simulateFailure`, `signWebhook` helpers).
- `moyasar` — stub. Refuses to instantiate without `MOYASAR_SECRET_KEY`.
- `tap` — stub. Refuses to instantiate without `TAP_SECRET_KEY`.

To integrate a real provider, implement the `PaymentProvider` interface
in `src/providers/payment-provider.ts` — the Financial Engine never depends
on a concrete SDK.

## Chart of accounts

```
PSP_CLEARING            asset       — cash held by the PSP for us before payout
HOST_PAYABLE:<userId>   liability   — money we owe a specific host
OWNER_PAYABLE:<userId>  liability   — money we owe an owner (sale / long-term)
OFFICE_PAYABLE:<id>     liability   — money we owe an office
MARKETER_PAYABLE:<id>   liability   — money we owe a marketer
PLATFORM_REVENUE        revenue     — net service revenue (VAT-excluded)
VAT_PAYABLE             liability   — VAT collected on our behalf
PAYMENT_GATEWAY_FEE     expense     — what the PSP charged us
REFUND_CLEARING         asset       — outbound refund in flight
```

## Tests

```bash
npm test                  # 45 tests across 8 files
```

Coverage includes:
- money helpers, rounding modes, spec test amounts
- tax engine (residential exempt, commercial taxable, no-rule fallback)
- commission engine (daily rental host-full, sale office+marketer split)
- pricing engine golden-rule + all spec amounts
- ledger balance invariants, capture/refund posting
- end-to-end sandbox flow through the webhook route (all spec amounts)
- refund full/partial/idempotent + refund-exceeds guard
- webhook signature enforcement + deduplication

## What is NOT here yet (and NEEDS work)

- Real JWT/OTP verification (currently header-based dev auth). Put an
  API gateway with token verification in front before shipping.
- ZATCA Fatoora Phase 2 XML + QR + Public API integration.
- Moyasar / Tap adapters — only stubs, refuse to run without secrets.
- Payout worker — settlements are created as PENDING; wiring them to
  provider payouts is left to the payout job.
- KYC/AML integration — the `Kyc` table is present but `payoutEnabled`
  gating is manual.

## Security posture

- No credit-card data ever touches this DB. PSPs hold PAN, we hold token IDs.
- Secrets live only in `.env` on the server. Never in source, never in the
  mobile/web clients.
- Webhook route verifies HMAC before touching state.
- Refund/webhook/checkout are idempotent by design.
- All money math uses BigInt and configurable rounding (`MONEY_ROUNDING`).
- Do not run seeds against a production database.
