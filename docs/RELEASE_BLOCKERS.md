# SakanHub — Consolidated Release Blockers

One authoritative table. Every P0 blocks TestFlight. P1 blocks GA
(public release). P2 is quality-of-life before scale-up. EXTERNAL is
what only a real-world provider / regulator / accountant can deliver.

| # | Priority | Issue | Why | Required Action | Owner | Can do on this Linux container? | Needs Mac / Xcode? | Needs external company / authority? |
|---|---|---|---|---|---|---|---|---|
| B-01 | P0 | No Xcode project | SPM library alone cannot produce an `.ipa` | Follow `docs/XCODE_HANDOFF.md` § 3–5 | iOS lead | ❌ | ✅ | — |
| B-02 | P0 | No real App Icon (1024×1024) | App Store rejects placeholder | Deliver icon PNG | Designer | ⚠️ Design brief only | ✅ (embed in Xcode) | — |
| B-03 | P0 | iOS not yet compiled | Compile status UNKNOWN | First build on Mac | iOS lead | ❌ | ✅ | — |
| B-04 | P0 | No PSP integration in production | Payments cannot run | Choose Tap or Moyasar, integrate `PaymentProvider` methods, load real credentials via secrets manager | Backend + finance | ⚠️ Adapter code | — | ✅ Tap / Moyasar contract |
| B-05 | P0 | ZATCA Fatoora Phase 2 not wired | Cannot legally issue tax invoices at scale | Onboard with ZATCA API, obtain cert + Public Key, sign XML | Backend + tax advisor | ⚠️ Adapter code | — | ✅ ZATCA + tax advisor |
| B-06 | P0 | No REGA electronic-platform license | Cannot legally operate as a real-estate platform in KSA | File license application | Legal | ❌ | — | ✅ REGA |
| B-07 | P0 | No Nafath integration | Cannot verify advertiser identity per REGA | Contract with Elm / Nafath and implement | Backend + legal | ⚠️ Adapter code | — | ✅ Elm |
| B-08 | P0 | Privacy Policy + Terms of Use URLs missing | Apple + REGA + PDPL all require it | Draft legally-reviewed pages, host on `sakanhub.com/legal/*` | Legal + web | ⚠️ Web pages | — | ✅ Legal counsel |
| B-09 | P0 | Domain + SSL not registered | Production API + web pages have no host | Register `sakanhub.com`, issue cert | Infra | ❌ | — | ✅ Registrar + CA |
| B-10 | P0 | Production database not provisioned | Currently SQLite only | Provision managed Postgres, run first migration | Backend + infra | ⚠️ Schema is ready (portable) | — | ✅ Hosting provider |
| B-11 | P0 | Secrets manager not set up | `.env` cannot ship as-is | Doppler / AWS Secrets Manager + inject at deploy | Infra | ❌ | — | ✅ Provider |
| B-12 | P0 | SMS provider not contracted | `POST /v1/auth/otp` cannot send in prod | Unifonic / Twilio contract + sender-id approval | Infra + legal | ❌ | — | ✅ Provider + MCIT |
| B-13 | P0 | App Store Connect app record + screenshots + description | Prerequisite for submission | Create record, fill all fields, upload assets | Marketing + designer | ⚠️ Copy drafts | ✅ (upload via Xcode / ASC) | — |
| B-14 | P1 | Sign in with Apple offered when any social login is added | Guideline 4.8 | If added, wire `AuthenticationServices`; else N/A | iOS lead | ✅ Skeleton only | ✅ | — |
| B-15 | P1 | Push notifications not wired | No engagement channel | APN key + backend send channel | iOS + backend | ⚠️ Backend send code | ✅ | ✅ Apple |
| B-16 | P1 | `/v1/account/export` (PDPL Article 21 subject-access) | Currently manual SQL | Add endpoint that returns a signed download of user's data footprint | Backend | ✅ | — | — |
| B-17 | P1 | Cert pinning for PSP webhook + refund flow | Defence in depth | Use `URLSession` `serverTrust` delegate; pin backend cert | iOS lead | ✅ Code | ✅ Test on device | — |
| B-18 | P1 | Booking availability + double-booking guard in a Postgres transaction with `SELECT FOR UPDATE` | SQLite is not multi-writer safe | Once on Postgres, wrap the availability check + booking create in `serializable` isolation | Backend | ✅ | — | — |
| B-19 | P1 | `Property.regaLicenseNumber` field + advertiser accuracy declaration | REGA advertisement rules | Add field to schema + Zod + admin approval flow | Backend + legal | ✅ | — | ✅ REGA |
| B-20 | P1 | Complaints mechanism (route + moderation queue) | REGA + PDPL | Add `Complaint` model, endpoint, admin view | Backend + support | ✅ | — | — |
| B-21 | P1 | Refund + Cancellation policy per listing | REGA transparency | Add `RefundPolicy` model or per-transaction-type default; display before checkout | Backend + iOS | ✅ | ✅ (iOS side) | — |
| B-22 | P1 | Rate-limit exemption for webhook route | PSP retry burst may 429 | `@fastify/rate-limit` `allowList` for PSP IPs | Backend | ✅ | — | — |
| B-23 | P1 | CORS origin whitelist | Currently `origin: true` in `src/main.ts` | Set to `https://app.sakanhub.com` in prod | Backend | ✅ | — | — |
| B-24 | P1 | Sentry backend + iOS projects with token redaction | Debugging in prod | Provision Sentry, install SDKs, configure PII scrubbing | Backend + iOS | ⚠️ Code | ✅ iOS side | ✅ Sentry account |
| B-25 | P2 | Offline mode (SwiftData / CoreData cache) | Read continuity | Cache last-fetched properties + bookings | iOS lead | ✅ | ✅ | — |
| B-26 | P2 | Universal Links (`applinks:sakanhub.com`) | Deep links from SMS / email | Serve `apple-app-site-association` file | Backend + iOS | ✅ | ✅ | — |
| B-27 | P2 | Grafana / dashboards over Ledger accounts | Finance observability | Grafana + Postgres source | Infra + finance | ❌ | — | — |
| B-28 | P2 | PDF invoice generator | UX + regulator handoff | Node PDF library + template | Backend | ✅ | — | — |
| B-29 | P2 | Subscription / advertisement billing workers | Revenue automation | cron worker per model | Backend | ✅ | — | — |
| B-30 | P2 | Booking expiry cron (30-min TTL on `pending_payment`) | Data hygiene | Small cron | Backend | ✅ | — | — |
| E-01 | EXTERNAL | Real-estate activity CR (682010) | REGA license precondition | File with Ministry of Commerce | Legal | ❌ | — | ✅ MC |
| E-02 | EXTERNAL | Responsible Manager appointment | REGA precondition | Contract a qualified Saudi national | Legal + HR | ❌ | — | ✅ REGA |
| E-03 | EXTERNAL | Compliance training completion | REGA precondition | Enrol in REGA training | Legal | ❌ | — | ✅ REGA |
| E-04 | EXTERNAL | ZATCA e-invoice certificate | Fatoora Phase 2 | Obtain cert, load into backend | Backend + tax | ❌ | — | ✅ ZATCA |
| E-05 | EXTERNAL | Apple Developer membership | App Store prerequisite | Enrol, obtain Team ID | Owner | ❌ | — | ✅ Apple |
| E-06 | EXTERNAL | SMS sender-id approval | OTP delivery | MCIT filing | Legal | ❌ | — | ✅ MCIT |
| E-07 | EXTERNAL | Sadad / Mada acceptance | Local card rails | Through the chosen PSP | Finance | ❌ | — | ✅ PSP |
| E-08 | EXTERNAL | Accounting policy sign-off (VAT treatment + revenue recognition) | Trust of the Financial Engine | Accounting firm review of pricing engine + ledger | Finance | ⚠️ Provide `docs/API_CONTRACT.md` + `financial/*.ts` for review | — | ✅ Accountant |
