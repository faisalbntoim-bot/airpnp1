# SakanHub — REGA Compliance Checklist

**⚠️ SakanHub does NOT currently hold a REGA license or a Real-Estate
General Authority approval.** This document lists the requirements
identified from the public REGA / Ministry of Municipal and Rural
Affairs and Housing (MOMRAH) rulebook so the team knows exactly what
must be resolved before commercial launch in the Kingdom of Saudi Arabia.

Legend: 🟢 IMPLEMENTED · 🟡 PARTIAL · 🔴 MISSING · 🔗 EXTERNAL APPROVAL

## Legal entity + licensing

| # | Requirement | Status | Notes |
|---|---|---|---|
| 1 | Saudi Commercial Registration (سجل تجاري) — activity code 682010 (real-estate brokerage & rental) or the electronic-platform equivalent | 🔗 EXTERNAL | Issue via Ministry of Commerce (MC) |
| 2 | Electronic Real Estate Platform license (رخصة منصة إلكترونية عقارية) from REGA | 🔗 EXTERNAL | Application + fee + technical audit |
| 3 | Real-Estate Advertisement license (رخصة الإعلان العقاري / رخصة فال) for the platform + each advertiser | 🔗 EXTERNAL | Per-user; the platform must verify |
| 4 | Responsible Manager (مدير مسؤول) named in the license | 🔴 MISSING | Must be Saudi national with clean record |
| 5 | Ministry of Communications and Information Technology (MCIT) approval for SMS sender-id | 🔗 EXTERNAL | Required for OTP delivery |
| 6 | Saudi Business Center (المركز السعودي للأعمال) profile | 🔗 EXTERNAL | |
| 7 | Ministry of Tourism license (رخصة الترخيص السياحي) — ONLY IF operating short-term rentals as a licensed provider | 🔗 EXTERNAL | Applicable to daily rentals |
| 8 | Compliance officer / owner training completion | 🔴 MISSING | REGA runs periodic courses |

## Identity + Nafath

| # | Requirement | Status | Notes |
|---|---|---|---|
| 9 | Nafath (نفاذ) integration for advertiser identity verification | 🔴 MISSING | Elm / IAM API — external contract |
| 10 | Absher (أبشر) integration for national-id validation (alternative) | 🔴 MISSING | Optional if Nafath is used |
| 11 | Store hashed proof of ID verification (not raw ID) | 🔴 MISSING | No `IdentityVerification` model yet |
| 12 | Real-time re-verification when advertiser status changes | 🔴 MISSING | |

## Property advertisement rules

| # | Requirement | Status | Notes |
|---|---|---|---|
| 13 | Every listing carries the REGA advertisement licence number visibly | 🟡 PARTIAL | `Property.listingNumber` exists; a separate `regaLicenseNumber` field is not yet in the schema |
| 14 | Property ownership document (صك) or delegation attached | 🔴 MISSING | Requires document-upload endpoint + review workflow |
| 15 | Broker's / office's FAL license attached (if broker-facilitated) | 🔴 MISSING | Requires `FALLicense` model |
| 16 | Advertisement content requirements: price, area, location, features, images | 🟡 PARTIAL | Fields exist in `Property` — enforcement (required-field validation) needs a stricter Zod schema |
| 17 | Advertiser accuracy declaration (إقرار بالصحة) with timestamp | 🔴 MISSING | Persist consent alongside `pdplConsentAt` |
| 18 | Prohibition on misleading claims + auto-flag on obvious violations | 🔴 MISSING | Requires moderation queue |
| 19 | Right to remove any listing at REGA's request | 🟢 IMPLEMENTED | Admin can set `Property.status = 'hidden'` via `PATCH /v1/admin/properties/:id` (not yet exposed) |

## Consumer protection + PDPL

| # | Requirement | Status | Notes |
|---|---|---|---|
| 20 | PDPL (نظام حماية البيانات الشخصية) — user consent capture at signup | 🟡 PARTIAL | `User.pdplConsentAt` field exists; UI signup does not persist it yet |
| 21 | Privacy Policy in Arabic, hosted on a durable URL | 🔴 MISSING | See `docs/APPLE_RELEASE_CHECKLIST.md` |
| 22 | Terms of Use in Arabic | 🔴 MISSING | |
| 23 | Complaints mechanism (آلية شكاوى) — accessible URL + logged | 🔴 MISSING | No `Complaint` model or route |
| 24 | Data retention policy documented | 🔴 MISSING | Must justify how long `AuditLog`, KYC data, etc. are kept |
| 25 | Data-portability + deletion request handling | 🟡 PARTIAL | `DELETE /v1/account` implemented (anonymises); no full export yet |
| 26 | Breach-notification procedure (72h to SDAIA if applicable) | 🔴 MISSING | Document |
| 27 | Cookie / tracking disclosure on the web version | 🟡 PARTIAL | iOS uses no tracking; web (`docs/sakan-ai.html`) needs review |

## Financial + advertising transparency

| # | Requirement | Status | Notes |
|---|---|---|---|
| 28 | All fees disclosed to the consumer BEFORE payment | 🟢 IMPLEMENTED | `computeQuote` returns every line item; iOS booking screen shows only server numbers |
| 29 | No hidden charges after checkout | 🟢 IMPLEMENTED | `Payment.grossAmountHalalahs` is fixed at start |
| 30 | Refund policy visible per listing / booking type | 🔴 MISSING | Requires `RefundPolicy` model + UI |
| 31 | Cancellation policy visible per listing | 🔴 MISSING | |
| 32 | Prices in SAR only | 🟢 IMPLEMENTED | Backend rejects mismatched currency at booking creation |
| 33 | Financial records retained per Saudi tax law (10 years) | 🟢 IMPLEMENTED | Ledger + Invoice + Payment are immutable; account deletion anonymises identity but keeps rows |

## Technical integration

| # | Requirement | Status | Notes |
|---|---|---|---|
| 34 | REGA / Ejar (إيجار) e-contract integration where applicable (long-term rental) | 🔗 EXTERNAL | Ejar has its own API — not yet integrated |
| 35 | ZATCA Fatoora Phase 2 e-invoicing | 🔴 MISSING | `Invoice.xmlRef` is a stub; needs certificate + Public Key + onboarding |
| 36 | Data hosting inside KSA (recommended for regulated data) | 🔴 MISSING | Cloud region selection |
| 37 | Domain registered under a recognised registrar with Saudi presence | 🔴 MISSING | |
| 38 | SSL certificate visible on public URLs | 🔴 MISSING | HTTPS required |

## Do NOT claim

- "Approved by REGA"
- "Licensed real-estate platform" (until license is issued)
- "Registered advertiser" (until Nafath integration ships)
- "ZATCA-compliant e-invoice" (until certificate is loaded)

## Owner assignments (fill in)

| Requirement group | Owner | Target date |
|---|---|---|
| Legal entity + licensing | (name) | (date) |
| Nafath + KYC | (name) | (date) |
| Advertisement rules | (name) | (date) |
| PDPL + privacy | (name) | (date) |
| ZATCA / e-invoicing | (name) | (date) |
