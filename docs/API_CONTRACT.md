# SakanHub Backend API Contract

Snapshot of the Fastify + Prisma backend surface on branch `claude/web-app-airpnp-dn3mvr` (commit `e825a32`).

**Base URL** (development): `http://localhost:4000`
**Production**: `https://api.sakanhub.example` (placeholder — set via env)

**Auth**: Bearer JWT.

```
Authorization: Bearer <access_token>       # issued by /v1/auth/otp/verify or /v1/auth/refresh
```

The `x-user-id` + `x-user-role` header pair is accepted **only** when `NODE_ENV` is `development` or `test`. In `production` it is rejected — the JWT is the only auth path. See `backend/src/auth/rbac.ts`.

**Money**: every monetary field is a `BigInt` halalah (1 SAR = 100 halalahs), returned as a **string** to preserve precision through JSON. `"31725"` = 317.25 SAR.

**IDs**: Prisma `cuid` strings (not UUIDs).

**Idempotency**: any write endpoint accepts `Idempotency-Key: <uuid>`. A retry with the same key + same body returns the memoised response; same key + different body → `409 CONFLICT`.

---

## Health

### `GET /healthz`
No auth. → `{ "ok": true, "env": "development" }`

---

## Auth

### `POST /v1/auth/otp`
No auth. Rate-limited to 3 requests per phone per 10-minute rolling window.

```jsonc
// Request
{ "phone": "+9665XXXXXXXX" }
// 200 OK
{ "requestId": "clz…", "expiresInSeconds": 300 }
```

In `NODE_ENV=development` the 6-digit code is logged to the server console. In production a real SMS provider (Unifonic / Twilio) must be wired in `src/auth/otp.ts:sendOtpSms`.

Errors: `400 BAD_REQUEST` (bad phone), `409 CONFLICT` (rate-limited).

### `POST /v1/auth/otp/verify`
Auto-signup by phone. Consumes the challenge on success, revokes it on 5 wrong attempts.

```jsonc
// Request
{ "requestId": "clz…", "phone": "+9665XXXXXXXX", "code": "123456", "nameAr": "…" /* optional on first signup */ }
// 200 OK
{
  "user": { "id": "clz…", "phone": "+9665…", "nameAr": "…", "role": "CUSTOMER" },
  "accessToken":      "<jwt>",                // 15 min TTL
  "refreshToken":     "<opaque base64url>",   // 30 day TTL, hashed at rest, one-time use (rotated)
  "accessExpiresIn":  900,
  "refreshExpiresIn": 2592000
}
```

Errors: `401 UNAUTHORIZED` (`invalid code` | `code expired` | `code already used` | `too many attempts` | `invalid request`).

### `POST /v1/auth/refresh`
Rotates the refresh token; revokes the presented one; issues a fresh pair.

```jsonc
{ "refreshToken": "<opaque>" }  →  { accessToken, refreshToken, accessExpiresIn, refreshExpiresIn }
```

Errors: `401 UNAUTHORIZED` (`unknown` | `revoked` | `expired`).

### `POST /v1/auth/logout`
Auth required. Body `{ refreshToken }` revokes just that token; empty body logs out this session's tokens by relying on `/refresh` rotation to also succeed only against a live token.

### `GET /v1/auth/me`
Auth required. Returns caller identity + all granted roles + the role from the current access token.

---

## Properties

### `GET /v1/properties`
No auth required for the public projection. Auth needed to filter by non-`available` status or by another user's `ownerId` (admin only for arbitrary owners).

Query: `page`, `pageSize` (max 50), `search`, `category`, `purpose`, `city`, `status`, `ownerId`.

```jsonc
// 200 OK
{
  "items": [ { "id":"…", "listingNumber":"…", "category":"apartment", … /* ownerId hidden from public */ } ],
  "page": 1, "pageSize": 20, "total": 42
}
```

### `GET /v1/properties/:id`
No auth for `available` listings. Hidden/reserved/sold/rented require auth: owner sees full record + `ownerId`; admin sees everything; others get `404`.

### `GET /v1/properties/:id/availability`
No auth. Overlap of existing `pending_payment` + `confirmed` bookings against the query window.

```jsonc
// GET /v1/properties/:id/availability?from=…&to=…
{
  "propertyId": "…",
  "from": "2026-09-01T…", "to": "2026-09-10T…",
  "isAvailable": false,
  "bookedRanges": [ { "from": "…", "to": "…", "bookingId": "…", "status": "confirmed" } ]
}
```


---

## Bookings

### `POST /v1/bookings`
Auth: any role. Creates a booking in `draft`. Rejects overlapping bookings for the same property (`409 CONFLICT`) and currency mismatches against the property (`400 BAD_REQUEST`).

```jsonc
// Request
{
  "propertyId": "clzprop123",
  "transactionType": "DAILY_RENTAL",           // DAILY_RENTAL | LONG_TERM_RENTAL | COMMERCIAL_RENTAL | SALE
  "grossAmount": "300",                        // major units (string or number)
  "currency": "SAR",                           // ISO 4217 (3 chars)
  "nights": 3,                                 // optional
  "checkIn":  "2026-09-01T14:00:00.000Z",      // optional ISO 8601
  "checkOut": "2026-09-04T11:00:00.000Z",      // optional
  "idempotencyKey": "…"                        // optional
}

// 200 OK
{
  "booking": {
    "id": "clzbk…",
    "propertyId": "clzprop123",
    "customerId": "<caller>",
    "hostId": "<primary host of property>",
    "transactionType": "DAILY_RENTAL",
    "grossAmountHalalahs": "30000",            // 300 SAR
    "currency": "SAR",
    "status": "draft",
    "createdAt": "…"
    /* ... */
  },
  "quote": { /* see /v1/quote response */ }
}
```

Errors: `400 BAD_REQUEST` (invalid body / non-positive amount), `404 NOT_FOUND` (property).

### `GET /v1/bookings/:id`
Auth: booking.customer OR booking.host OR ADMIN/FINANCE_ADMIN/SUPER_ADMIN. Others → `404`.
Returns booking + items + payments + invoice + property.

### `POST /v1/quote`
**Currently unauthenticated** (⚠️ pricing exposure). Preview a quote without creating a booking.

```jsonc
// Request
{
  "transactionType": "DAILY_RENTAL",
  "propertyType": "apartment",                 // optional
  "grossAmount": "300",
  "currency": "SAR"
}

// 200 OK — a Quote
{
  "currency": "SAR",
  "transactionType": "DAILY_RENTAL",
  "grossAmountHalalahs": "30000",              // 300 SAR
  "commission": {
    "ruleId": "clzcr…",
    "platformFeeHalalahs": "1500",             // 15 SAR
    "officeShareHalalahs": "0",
    "marketerShareHalalahs": "0",
    "ownerAmountHalalahs":   "0",
    "hostAmountHalalahs":    "30000",          // 300 SAR to host
    "currency": "SAR"
  },
  "taxOnPlatformFee": {
    "status": "applied", "ratePercent": 15,
    "taxableAmountHalalahs": "1500",
    "taxAmountHalalahs":     "225"             // 2.25 SAR
  },
  "taxOnRental": {
    "status": "exempt", "ratePercent": 0,
    "taxAmountHalalahs": "0",
    "reasonCode": "SA_VAT_RESIDENTIAL_EXEMPT"
  },
  "customerTotalHalalahs":      "31725",       // 317.25 SAR
  "platformNetRevenueHalalahs": "1500"         // 15 SAR (VAT is a liability, not revenue)
}
```

---

## Payments

### `POST /v1/payments`
Auth: booking.customer (or any admin). Non-owners receive `404 NOT_FOUND` to avoid probing.

```jsonc
// Request
{
  "bookingId": "clzbk…",
  "returnUrl": "https://client.example/return",  // optional
  "customer": { "name": "…", "email": "…", "phone": "…" } // optional
}

// 200 OK
{
  "paymentId":         "clzpay…",
  "providerPaymentId": "sb_pay_…",
  "redirectUrl":       "sandbox://checkout/sb_pay_…",
  "quote":             { /* full Quote */ }
}
```

Uses `Idempotency-Key` (auto-generated if omitted).

### `GET /v1/payments/:id`
Auth: booking.customer / booking.host / any ADMIN role. Others → `404`.
Returns payment + booking + refunds + invoice.

### `POST /v1/payments/webhook`
No auth header — verifies HMAC signature instead.

- Sandbox provider: `X-Sandbox-Signature: <hex hmac-sha256>` over the raw body, secret = `sandbox-webhook-secret`
- Body: `{ "id":"evt_…", "type":"payment.captured", "providerPaymentId":"sb_pay_…", "orderRef":"<paymentId>", "status":"captured", "amountHalalahs":"31725", "currency":"SAR" }`

Dedup by `(provider, externalEventId)`. Returns `{ok:true}` or `{ok:true, duplicate:true}`.

---

## Refunds

### `POST /v1/payments/:id/refund`
Auth: `ADMIN | FINANCE_ADMIN | SUPER_ADMIN` unconditionally, or `HOST` where `booking.hostId === caller.userId`, or `OFFICE` where either the property owner or `booking.officeId` is the caller. Unauthorised roles → `404 NOT_FOUND`.

```jsonc
// Request (empty = full refund)
{ "amount": "50", "reason": "guest cancelled" }

// 200 OK
{
  "refundId":         "clzref…",
  "providerRefundId": "sb_ref_…",
  "amountHalalahs":   "5000",
  "status":           "completed"
}
```

Refund state transitions: `pending → processing → completed | failed | cancelled`.

---

## Wallet

### `GET /v1/wallet`
Auth: any authenticated user. Balances are derived from the immutable ledger and settlement rows — no mutable `balance` column.

```jsonc
{
  "availableHalalahs":     "0",     // KYC-cleared, ready to pay out (settlement status=ELIGIBLE)
  "pendingHalalahs":       "0",     // PENDING + PROCESSING
  "paidHalalahs":          "0",     // settlement status=PAID
  "refundedHalalahs":      "0",
  "failedHalalahs":        "0",
  "totalEarningsHalalahs": "30000",
  "ledger": {
    "hostPayable":     "30000",
    "ownerPayable":    "0",
    "officePayable":   "0",
    "marketerPayable": "0"
  }
}
```

### `GET /v1/settlements`
Auth: any authenticated user. Returns their own settlements only (via `beneficiary.userId === caller.userId`).

### `GET /v1/transactions`
Auth: any authenticated user. Ledger entries touching accounts owned by the caller.

---

## Invoices

### `GET /v1/invoices/:id`
Auth: booking.customer / booking.host / any ADMIN role. Others → `404`.

```jsonc
{
  "id": "clzinv…",
  "invoiceNumber":         "SKN-2026-000042",
  "sellerName":            "SakanHub",
  "sellerVatNumber":       null,
  "buyerName":             "…",
  "subtotalHalalahs":      "31500",
  "taxableAmountHalalahs": "1500",
  "taxRatePercent":        15,
  "taxAmountHalalahs":     "225",
  "totalHalalahs":         "31725",
  "currency":              "SAR",
  "status":                "issued",   // draft | issued | credited | cancelled
  "pdfRef":                null,
  "xmlRef":                null        // stays null until ZATCA adapter is wired
}
```

---

## Beneficiaries + Payouts

### `POST /v1/beneficiaries`
Auth: any authenticated user (one beneficiary per user). Card / IBAN is tokenised by the PSP — SakanHub only keeps the provider id + masked IBAN.

```jsonc
// Request
{ "name": "Full name", "iban": "SA00…", "bankName": "…" }

// 200 OK
{ "id":"…", "provider":"sandbox", "externalBeneficiaryId":"…", "ibanMasked":"SA00**…**", "payoutEnabled": true }
```

### `GET /v1/beneficiaries/me`
Auth: any authenticated user.

### `POST /v1/admin/settlements/:id/mark-eligible`
Auth: ADMIN/FINANCE_ADMIN/SUPER_ADMIN. Requires KYC `FULL/approved` + `payoutEnabled=true`.

### `POST /v1/admin/settlements/:id/payout`
Auth: ADMIN/FINANCE_ADMIN/SUPER_ADMIN. Triggers `provider.createPayout`; optimistic ELIGIBLE→PROCESSING lock.

---

## Admin — Rules

Auth on all: `ADMIN | FINANCE_ADMIN | SUPER_ADMIN`.

- `GET/POST /v1/admin/commission-rules` · `PATCH /v1/admin/commission-rules/:id`
- `GET/POST /v1/admin/tax-rules`
- `GET/POST /v1/admin/ad-products`         *(upsert by code — NORMAL/FEATURED/PREMIUM/VIP)*
- `GET/POST /v1/admin/subscription-plans`  *(upsert by code — INDIVIDUAL/MARKETER/OFFICE/ENTERPRISE)*
- `GET      /v1/admin/overview?from=&to=`

---

## Enumerations

- **Role**: `CUSTOMER | HOST | OWNER | OFFICE | MARKETER | ADMIN | FINANCE_ADMIN | SUPER_ADMIN`
- **Property.category** (English lowercase): `apartment | villa | duplex | studio | land | office | shop | farm | commercial | building`
- **Property.purpose**: `sale | rent | daily | monthly | commercial_rent`
- **Property.status**: `available | reserved | sold | rented | hidden`
- **Booking.status**: `draft | pending_payment | confirmed | cancelled | completed`
- **Booking.transactionType**: `DAILY_RENTAL | LONG_TERM_RENTAL | COMMERCIAL_RENTAL | SALE`
- **Payment.status**: `pending | captured | failed | refunded | partial_refunded | cancelled`
- **Refund.status**: `pending | processing | completed | failed | cancelled`
- **Settlement.status**: `PENDING | ELIGIBLE | PROCESSING | PAID | FAILED | CANCELLED`
- **Invoice.status**: `draft | issued | credited | cancelled`

## Error shape

```jsonc
{ "error": "NOT_FOUND", "message": "booking not found", "details": { /* optional */ } }
```

- `400 VALIDATION` — Zod issues array under `issues`
- `400 BAD_REQUEST` — business validation
- `401 UNAUTHORIZED` — missing/invalid auth headers
- `403 FORBIDDEN` — role denied
- `404 NOT_FOUND` — resource missing (or access denied, to prevent probing)
- `409 CONFLICT` — idempotency conflict / illegal state transition
- `500 INTERNAL` — unhandled

## Contract mismatches — iOS vs Backend (audit)

| Field | Backend | iOS today |
|---|---|---|
| `id` on every model | `cuid` string | `UUID` |
| Money | BigInt halalahs (string in JSON) | `Double` |
| `Property.category` values | English (`apartment`, `villa`, …) | Arabic (`شقة`, `فيلا`, …) |
| `Property.purpose` values | `sale/rent/daily/monthly/commercial_rent` | Arabic (`للبيع`/`للإيجار`/…) |
| `Booking.status` values | `draft/pending_payment/confirmed/cancelled/completed` | `pending/confirmed/rejected/cancelled/completed` |
| `User.role` values | `CUSTOMER/HOST/OWNER/OFFICE/MARKETER/ADMIN/FINANCE_ADMIN/SUPER_ADMIN` | `owner/seeker/marketer/office` |
| Booking fields | `grossAmountHalalahs` only (fee/VAT come from quote) | `pricePerNightSAR`, `cleaningFeeSAR`, `serviceFeeSAR`, `vatSAR`, `totalSAR` all as `Double` |
| Wallet / Refund / Settlement / Invoice / Payout / Beneficiary | Full models | Missing on iOS |
| Auth | JWT (behind gateway) + `x-user-*` headers | No auth stack |
