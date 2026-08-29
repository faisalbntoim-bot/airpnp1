# SakanHub iOS Production Checklist

Status of the iOS module in `ios/SakanHub/` against production/TestFlight readiness.
None of this can be compiled here — verification of the iOS side requires macOS + Xcode.

---

## Legend
✅ Ready · ⚠️ Partial · ❌ Missing · 🚫 Not applicable

## Configuration & environments

| Item | Status | Notes |
|---|---|---|
| Backend URL | ⚠️ | `Config.apiBaseURL` reads `API_BASE_URL` from Info.plist with fallback `https://api.sakan.local` — no dev/staging/prod split |
| Environment split (dev / staging / prod) | ❌ | Not implemented. Recommendation: three `.xcconfig` files + separate schemes |
| `.xcconfig` for secrets | ⚠️ | `Config.swift` header documents the pattern; no `Secrets.xcconfig` exists yet |
| `USE_MOCKS` toggle | ❌ | Declared in `Config.swift` but consulted **nowhere** except a disabled `Toggle` in ProfileView. No code path selects a real implementation when set to NO |

## API integration

| Item | Status | Notes |
|---|---|---|
| Real API client exists | ⚠️ | `Core/Networking/APIClient.swift` present, but **has ZERO callers** — nothing in the app hits `/v1/*` |
| Real repositories | ❌ | All repositories are `MockXxxRepository`; no `HttpPropertyRepository` etc. |
| DI-based repository selection | ❌ | Views call `MockPropertyRepository()` directly in `StateObject(wrappedValue:)`, bypassing AppState's DI |
| Auth header injection | ❌ | APIClient does not attach `x-user-id`/`x-user-role`/`Authorization` |
| Error mapping (401/403/404/409/422/429/5xx) | ⚠️ | `APIError` covers 400/401/404 + generic http/network — missing 403/409/422/429 semantics |

## Authentication

| Item | Status | Notes |
|---|---|---|
| OTP request flow | ❌ | `MockUserRepository.signIn(phone:otp:)` exists as protocol shape; no real impl |
| JWT storage | ❌ | No Keychain wrapper, no token refresh |
| Session expiry / auto-logout | ❌ | Not modelled |
| Sign in with Apple | ❌ | Not present; may be required by Apple Review if any social login lands |

## Bookings, payments, wallet screens

| Item | Status | Notes |
|---|---|---|
| Booking calendar UI | ✅ | `BookingCalendarView` renders availability from a mock set |
| Real availability endpoint call | ❌ | No `GET /v1/properties/:id/availability` endpoint even on backend yet |
| Checkout screen shows backend-computed totals | ❌ | `Booking` uses `Double` fees; totals are computed on-device from mock rates |
| Payment flow via backend | ❌ | `MockPaymentService` returns fake approvals; no `POST /v1/payments` call, no webhook awareness |
| Wallet / Transactions / Invoices screens | ❌ | No models, no views |
| Refund flow | ❌ | Not present |

## Model / contract alignment

| Backend field | iOS type | Alignment |
|---|---|---|
| `id` (cuid string) | `UUID` | ❌ mismatch, decoding will fail |
| Money (`BigInt` halalahs string) | `Double` SAR | ❌ mismatch, precision lost + shape mismatch |
| `Property.category` (`apartment` …) | Arabic raw values (`شقة` …) | ❌ mismatch |
| `Property.purpose` | Arabic raw values | ❌ mismatch |
| `Booking.status` | Missing `draft`, `pending_payment` | ❌ decode-breaking |
| `User.role` (`CUSTOMER`/`HOST`/…) | (`owner`/`seeker`/…) | ❌ mismatch |
| Booking fee structure | fields differ | ❌ mismatch |

## HTTPS & ATS

| Item | Status | Notes |
|---|---|---|
| ATS default (HTTPS only) | ✅ | No `NSAllowsArbitraryLoads`, no `NSAppTransportSecurity` overrides. Production API MUST be HTTPS |
| Backend URL default | ⚠️ | `https://api.sakan.local` fallback is HTTPS, but not routable |
| Cert pinning | ❌ | Not implemented — optional, but recommended for payment flows |

## Info.plist keys

| Key | Present? | Notes |
|---|---|---|
| `NSCameraUsageDescription` | ✅ | AR / camera |
| `NSMotionUsageDescription` | ✅ | For AR |
| `NSLocationWhenInUseUsageDescription` | ✅ | Map + AR |
| `NSLocationTemporaryUsageDescriptionDictionary → ARGeoTracking` | ✅ | |
| `UIRequiredDeviceCapabilities → arkit` | ✅ | ⚠️ Restricts App Store install to ARKit devices — verify intent |
| `NSPhotoLibraryUsageDescription` | ❌ | Add if any Image picker is used |
| `NSPhotoLibraryAddUsageDescription` | ❌ | If saving images |
| `NSContactsUsageDescription` | 🚫 | Only if used |
| `NSUserTrackingUsageDescription` | 🚫 | Only if IDFA is used |
| `NSFaceIDUsageDescription` | ⚠️ | If biometric login lands |
| Push notification entitlement | ❌ | Not configured |
| `PrivacyInfo.xcprivacy` (Apple Privacy Manifest, mandatory since May 2024) | ❌ | Missing — App Store submission will be blocked |

## App Store assets (missing)

- App Icon set (1024×1024 + all @1x/@2x/@3x)
- Screenshots (6.7", 6.5", 5.5", iPad Pro 12.9", iPad Pro 11")
- App description (AR/EN), subtitle, keywords, category, age rating
- Privacy Policy URL, Terms of Use URL, Support URL, Marketing URL (optional)
- Review notes + demo account credentials
- App Privacy details (data types collected + linked-to-user + tracking)
- Account Deletion flow (Apple Guideline 5.1.1(v), mandatory since 2022) — **missing on iOS + backend**

## In-App Purchase decision (unresolved)

- Real-estate bookings → real-world service → **no IAP** (Guideline 3.1.5)
- Digital subscriptions (Marketer/Office/Enterprise) selling digital-only features → **must use IAP** if they exist as digital goods
- Featured/Premium/VIP ad boosts → grey area — often accepted with external payment when the underlying service is a real-estate listing

**Recommendation**: submit the Consumer app booking-only initially (no IAP). Separate Business flows into a distinct SKU or web-only.

## Testability & builds

| Item | Status |
|---|---|
| Swift Package builds on macOS | 🚫 UNVERIFIED — no macOS in this environment |
| Xcode project (`.xcodeproj`) | ❌ Only `Package.swift` — need app-target xcodeproj/xcworkspace |
| Unit tests for VMs | ❌ |
| UI tests | ❌ |
| CI (GitHub Actions with macOS runner) | ❌ |

## Steps required on macOS + Xcode

1. `open ios/SakanHub/Package.swift` in Xcode (or generate an app-target xcodeproj)
2. Rename `Info.plist.template` → `Info.plist` and add it to the target
3. Create three `.xcconfig` files:
   - `Development.xcconfig` — `API_BASE_URL = http://localhost:4000`
   - `Staging.xcconfig`     — `API_BASE_URL = https://staging.sakanhub.example`
   - `Production.xcconfig`  — `API_BASE_URL = https://api.sakanhub.example`
4. Create matching Xcode schemes (Development / Staging / Production)
5. Add `PrivacyInfo.xcprivacy` (Apple Privacy Manifest) with declared reason APIs
6. Add App Icon set to `Assets.xcassets`
7. Configure Signing & Capabilities: Team ID, App ID, Provisioning Profile
8. Add capabilities as needed: Push Notifications, Background Modes (audio/location if AR uses them), Sign in with Apple, Associated Domains (Universal Links)
9. Build & run on device (ARKit requires physical hardware, not simulator)
10. Archive → Upload to App Store Connect → TestFlight internal group
11. Fill App Privacy details in App Store Connect (data collection form)

## Release blockers (from this audit)

### P0 — Absolute blockers
1. iOS ↔ Backend integration is **0%** — no real API calls anywhere
2. Model contract mismatches (id types, money type, enum values) — decoding of every backend response will fail today
3. `PrivacyInfo.xcprivacy` missing — App Store submission blocked
4. Account Deletion flow — Apple guideline enforced
5. No real Authentication (OTP + JWT) on either side
6. Info.plist template not converted to real Info.plist + no `.xcconfig` files
7. No environment split (dev/staging/prod)

### P1 — High priority
8. Missing screens: Wallet, Transactions, Invoices, Refunds
9. Backend does not yet expose `GET /v1/properties*`, `GET /v1/properties/:id/availability`, or `POST /v1/auth/otp` — needs to happen before iOS can integrate meaningfully
10. Payment error semantics (403/409/422/429) not mapped in `APIError`
11. Push notification entitlement + APN key
12. Sign in with Apple (if any social login is added)

### P2 — Nice to have
13. Cert pinning for payment traffic
14. Offline mode (SwiftData/CoreData cache)
15. UI + Unit tests
16. Xcode Cloud or GitHub Actions macOS runner for CI
