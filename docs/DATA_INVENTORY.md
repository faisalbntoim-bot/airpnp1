# SakanHub — Data Inventory

Every category of personal / financial data the app touches, keyed to
its purpose, storage, access controls, retention, deletion path, and
third-party sharing. Kept in sync with:
- `PrivacyInfo.xcprivacy` (iOS)
- App Privacy Details in App Store Connect
- PDPL disclosures

Legend for access: **U** = user themselves · **H** = host of a booking ·
**A** = admin/finance admin · **P** = payment service provider (server-side only)

| Data | Purpose | Source | Storage | Who can access | Retention | Deletion path | 3rd-party sharing |
|---|---|---|---|---|---|---|---|
| Phone number | Authentication (OTP) | User at signup | Backend Postgres `User.phone`; iOS reads via `/v1/auth/me` | U · A | Life of account | `DELETE /v1/account` anonymises to `deleted:<id>` | SMS provider (Unifonic) for OTP delivery — hashed OTP never leaves our DB |
| Name (Ar / En) | Display + invoices | User at signup / profile edit | Backend `User.nameAr` / `nameEn` | U · A | Life of account | `DELETE /v1/account` → `[محذوف]` | None |
| Email (optional) | Notifications / receipts | User | Backend `User.email` | U · A | Life of account | `DELETE /v1/account` → null | Email provider when sending |
| National ID / IQAMA number | KYC — required for payout eligibility | Uploaded via KYC flow (not yet built) | Backend `Kyc.documentRef` (opaque provider reference, not the number itself) | U · A · KYC provider | Life of account + statutory | User can revoke; docs stay for regulator | Nafath / Elm |
| PDPL consent timestamp | Prove lawful basis under PDPL | User at signup checkbox | Backend `User.pdplConsentAt` | U · A | 10 years after last activity | Cleared on account deletion | None |
| Coarse location | Show nearby properties on the map | Device (WhenInUse) | Not persisted server-side; used in-memory for the current session | U | Not stored | Not stored | None |
| Camera + Motion | Augmented-reality view of properties | Device | Not persisted; frames are processed on-device | U | Session only | Session ends | None |
| Property photos | Listing display | Owner uploads | S3-compatible object storage (planned) + `PropertyMedia` metadata row | Public for `available` listings; owner + admin otherwise | Life of listing + backup retention | Delete listing → media removed | Served via CDN (planned) |
| Property ownership document (صك) | REGA verification | Advertiser uploads | Private S3 bucket (planned); reference stored in DB | Owner · admin · REGA if requested | Retained per REGA rules | Rehidden on account deletion; docs retained for regulator | REGA on request |
| Booking record | Contract of stay | System | Backend `Booking` row | Customer · host · admin | 10 years (Saudi tax law) | NOT deleted on account deletion (anonymised) | ZATCA when Phase 2 is wired |
| Payment record | Financial contract | Backend + PSP | Backend `Payment` row (never card data) | Customer · host · admin | 10 years | Anonymised via account deletion | PSP (Tap / Moyasar) hold the card token, not us |
| PSP payment token | Continue a payment | PSP | Backend `Payment.providerPaymentId` only — opaque reference | Backend · PSP | Life of payment | Not applicable | PSP holds the actual card |
| Card number / CVV | Charge a card | User at PSP checkout | **NEVER stored on our systems** | PSP only | Per PSP policy | Per PSP policy | PSP |
| Refund record | Reverse a payment | System | Backend `Refund` row | Customer · host · admin | 10 years | Anonymised | ZATCA (credit note) |
| Ledger entry | Double-entry accounting | System | Backend `LedgerEntry` row | Admin (via Wallet / Transactions endpoints) | Immutable — 10 years | NEVER deleted | ZATCA on request |
| Invoice | Tax invoice | System | Backend `Invoice` row + (future) PDF/XML in S3 | Customer · host · admin | 10 years (ZATCA) | Anonymised (identity fields) — invoice number retained | ZATCA when Phase 2 is wired |
| Settlement / payout | Payout to beneficiary | System | Backend `Settlement` row | Beneficiary user · admin | 10 years | Anonymised | PSP |
| Beneficiary IBAN (masked) | Payout destination | User at KYC | Backend `Beneficiary.ibanMasked` (full IBAN never stored) | User · admin · PSP | Life of account | Removed on deletion | PSP holds the real IBAN |
| Auth session (Access + Refresh) | Keep the user signed in | Backend on OTP verify | iOS Keychain (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`); backend `RefreshToken.tokenHash` (sha256 only) | User's device · backend | Access 15 min · Refresh 30 days | Logout / account deletion revokes all | None |
| Audit log | Investigate + regulator | Backend on every mutating action | `AuditLog` row | Admin | 10 years | NEVER deleted | ZATCA / REGA on request |
| Device information | Debugging | HTTP request (User-Agent) | Backend request log (redacted) | Admin | 90 days | Log rotation | Sentry (planned) with token redaction |
| Analytics | *(none)* | — | — | — | — | — | — |
| Advertising identifiers | *(none — no tracking)* | — | — | — | — | — | — |

## Cross-references

- Financial records (Bookings, Payments, Refunds, Ledger, Invoices, Settlements) are **NEVER hard-deleted** — they are anonymised on account deletion so regulators, auditors, and ZATCA can still reconstruct the transaction. This is explicit in `src/routes/account.ts`.
- Card / IBAN raw values are **NEVER** stored on SakanHub servers. The PSP tokenises them and we only keep the opaque reference.
- `DELETE /v1/account` refuses to proceed while a Payment is `pending` or a Settlement is `PENDING | ELIGIBLE | PROCESSING`.

## Subject-access-request path (PDPL)

Currently manual: admin can export `User` + related rows via a SQL query
against the Postgres replica. **Missing**: a first-party
`/v1/account/export` endpoint that returns a signed download of the
user's personal-data footprint. Recommended for PDPL Article 21
compliance — track as P1 in `RELEASE_BLOCKERS`.
