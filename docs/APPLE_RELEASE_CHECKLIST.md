# SakanHub — Apple TestFlight / App Store Release Checklist

Every item below is a real Apple gate. Nothing in this file is
speculative — each row maps to an App Store Connect field, a Guideline,
or a build-time requirement.

Legend: ✅ Ready · ⚠️ Partial · ❌ Missing · 🔗 Requires Apple Developer Account

## Apple Developer account + identifiers

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Apple Developer Program membership (99 USD/yr) | 🔗 | Individual or Organisation (org needs D-U-N-S) |
| 2 | Team ID recorded | 🔗 | Used by xcconfig / provisioning |
| 3 | Bundle Identifier registered in App Store Connect | ❌ | Suggested: `com.sakanhub.app` (currently placeholder in `Config/Shared.xcconfig`) |
| 4 | App ID (with capabilities: push, Sign-in-with-Apple if needed) | ❌ | |
| 5 | Provisioning profile (Development + Distribution) | ❌ | Automatic signing recommended |
| 6 | Push notifications APN Auth Key (`.p8`) | ❌ | Only if push is enabled |
| 7 | App Store Connect app record created | ❌ | Name + primary language + Bundle ID |

## Signing + build configuration

| # | Item | Status |
|---|---|---|
| 8 | 3 xcconfig files (Development / Staging / Production) | ✅ In `ios/SakanHub/Config/` |
| 9 | Info.plist with `$(API_BASE_URL)` + `$(USE_MOCKS)` substitution | ✅ |
| 10 | Assets.xcassets with AppIcon.appiconset + AccentColor.colorset | ✅ (placeholder icon README present — real 1024×1024 to be added) |
| 11 | Xcode project (`.xcodeproj` or `.xcworkspace`) | ❌ Requires Xcode |
| 12 | App-target created (SPM library is not distributable on its own) | ❌ Requires Xcode |
| 13 | Signing & Capabilities configured | ❌ Requires Xcode |
| 14 | Build succeeds on physical iPhone (ARKit requires device) | ❌ Requires Mac + iPhone |

## Info.plist permission strings (all in Arabic + iOS defaults to en)

| Key | Present | Notes |
|---|---|---|
| `NSCameraUsageDescription` | ✅ | AR + camera |
| `NSMotionUsageDescription` | ✅ | Device orientation for AR |
| `NSLocationWhenInUseUsageDescription` | ✅ | Map + AR |
| `NSLocationTemporaryUsageDescriptionDictionary` (ARGeoTracking) | ✅ | |
| `NSPhotoLibraryUsageDescription` | ❌ | Add if any image picker is added |
| `NSFaceIDUsageDescription` | ❌ | Add if biometric login is added |
| `NSUserTrackingUsageDescription` | ❌ | Only if IDFA is used (not planned) |
| `NSAppTransportSecurity` | (default) | HTTPS-only default is fine; no exceptions needed |
| `UIRequiredDeviceCapabilities` includes `arkit` | ✅ | ⚠️ Restricts installs to ARKit-capable devices — verify intent |

## Privacy Manifest (`PrivacyInfo.xcprivacy`) — MANDATORY since May 2024

| # | Item | Status |
|---|---|---|
| 15 | File present in Resources bundle | ✅ |
| 16 | `NSPrivacyTracking = false` | ✅ |
| 17 | Data types declared: PhoneNumber, Name, CoarseLocation (all linked-to-user, not for tracking) | ✅ |
| 18 | Reason APIs: UserDefaults (CA92.1), FileTimestamp (C617.1) | ✅ |
| 19 | Kept in sync with App Privacy Details in App Store Connect | ❌ Fill in App Store Connect form to match |

## App Privacy Details (App Store Connect form)

| Data type | Linked to user? | Used for tracking? | Purpose |
|---|---|---|---|
| Phone Number | Yes | No | App Functionality (auth) |
| Name | Yes | No | App Functionality |
| Email Address | Yes | No | App Functionality (optional) |
| Coarse Location | Yes | No | App Functionality (nearby properties) |
| Photos | No | No | Only picked images uploaded to a listing — none read from library today |
| Payment Info | No | No | Handled entirely by the PSP; SakanHub stores no card data |
| Purchase History | Yes | No | Booking / invoice records |

## Account Deletion (Guideline 5.1.1(v))

| # | Item | Status |
|---|---|---|
| 20 | In-app path to delete account | ✅ `Features/Account/AccountDeletionView.swift` |
| 21 | Backend endpoint | ✅ `DELETE /v1/account` (anonymises, revokes tokens, hides properties) |
| 22 | Refuses while money in flight (409) | ✅ Tested |
| 23 | User is signed out on success | ✅ |
| 24 | Sensitive info deleted / anonymised | ✅ phone/email/name replaced; financial rows retained for audit |

## Payment rules (Guideline 3.1)

| # | Rule | Applies? | Status |
|---|---|---|---|
| 25 | 3.1.5(a): Real-world goods & services use PSP, NOT IAP | ✅ Applies — daily rentals, sales, brokerage | ✅ Planned via Tap/Moyasar |
| 26 | 3.1.1: Digital goods → must use IAP | ⚠️ Applies IF `Subscription` becomes a digital-only offering | ❌ Not yet decided — recommend excluding subscriptions from the consumer app |
| 27 | 3.1.3(a): "Reader" app external link entitlement | ❌ Not needed for real-world services |

## Sign in with Apple (Guideline 4.8)

| # | Rule | Status |
|---|---|---|
| 28 | If a third-party social login (Google / Facebook) is added, Sign in with Apple must be offered as equal option | N/A — currently OTP only |
| 29 | If added later, use the `AuthenticationServices` framework | ❌ |

## App Store assets

| Asset | Spec | Status |
|---|---|---|
| App Icon | 1024×1024 PNG, no alpha, no transparency | ❌ placeholder |
| iPhone screenshots (6.7", 6.5", 5.5") | 3–10 per device size, .png/.jpeg | ❌ |
| Arabic screenshots | Required for KSA store | ❌ |
| English screenshots | Required for global store | ❌ |
| Preview video | Optional | ❌ |
| App name | ≤ 30 chars — recommend "سكن هوب" (ar) / "SakanHub" (en) | ⚠️ Set in Info.plist as `سكن هوب` |
| Subtitle | ≤ 30 chars | ❌ |
| Promotional text | ≤ 170 chars | ❌ |
| Description (ar + en) | ≤ 4000 chars | ❌ |
| Keywords | ≤ 100 chars total | ❌ |
| Support URL | Public, monitored | ❌ (need `support.sakanhub.com`) |
| Marketing URL | Optional | ❌ |
| Privacy Policy URL | REQUIRED | ❌ |
| Age Rating | Complete the questionnaire — likely 4+ | ❌ |
| Category | Primary: Travel or Real Estate; Secondary: Business | ❌ |

## Review submission

| # | Item | Status |
|---|---|---|
| 30 | Reviewer notes (Arabic + English) | ❌ |
| 31 | Demo account credentials (phone number + shared OTP or bypass code) | ❌ Reviewer needs a way to sign in without a real SMS |
| 32 | Sample listings visible without login | ✅ `/v1/properties` is public |
| 33 | Review notes explain AR requires physical device | ❌ |
| 34 | Screenshots reflect the actual current UI (no faked features) | ❌ |
| 35 | No placeholder "Coming soon" copy visible in the shipped build | ⚠️ Verify before submission |

## TestFlight-specific

| # | Item | Status |
|---|---|---|
| 36 | Internal test group (up to 100 team members) | ❌ |
| 37 | External test group (needs Beta App Review — first submission takes ≤ 24h) | ❌ |
| 38 | Test information filled in (feedback email, description) | ❌ |
| 39 | Legal agreements signed in App Store Connect | 🔗 |

## Do NOT claim

- iOS build succeeds until it actually builds on Xcode
- App Store approval until the app has been submitted and reviewed
- Compliance with any guideline that requires a live PSP integration
