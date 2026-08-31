# SakanHub — Mac First-Day Checklist

The single ordered path to a working iOS build + smoke tests on a Mac.

Baseline: repo commit `95c00ee` on `claude/web-app-airpnp-dn3mvr` — Backend
117/117 tests, TypeScript 0 errors, `dist/` builds cleanly. No production
credentials are required for Day 1.

For the broader references see `docs/XCODE_HANDOFF.md`,
`docs/APPLE_RELEASE_CHECKLIST.md`, and `docs/RELEASE_BLOCKERS.md`.
This document is the operational sequence — start at step 1, do not skip.

---

## 0 — Prerequisites (before opening Xcode)

- macOS 14.5 or later
- Xcode 15.3+ installed and launched at least once (accepts license)
- Apple Developer Program membership + Team ID (`Xcode → Settings → Accounts`)
- Homebrew installed
- One physical iPhone (ARKit does not run in the simulator)
- Lightning / USB-C cable + phone unlocked + "Trust this Computer" tapped

```bash
brew install node@22 postgresql@16 git
node -v            # must print 22.x
psql --version     # must print 16.x
```

---

## 1 — Clone the repository

```bash
git clone https://github.com/faisalbntoim-bot/airpnp1.git
cd airpnp1
git checkout claude/web-app-airpnp-dn3mvr
git rev-parse HEAD           # expect: 95c00ee…
```

Verify branch + working tree:
```bash
git status                    # expect: nothing to commit, working tree clean
git log --oneline -1
```

---

## 2 — Boot the backend locally

```bash
cd backend
cp .env.example .env          # fine as-is for Day 1 (sandbox PSP, sqlite)
npm ci
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run dev                   # http://localhost:4000
```

In another terminal, confirm:
```bash
curl -s http://localhost:4000/healthz
# {"ok":true,"env":"development"}
```

Full suite (should print 117 / 117):
```bash
npm test
```

---

## 3 — Open the SPM package in Xcode

```bash
cd ../ios/SakanHub
open Package.swift
```

Xcode opens the SPM. This alone is **not** a distributable app — it is a
library target. Steps 4–7 create the app target that Xcode can archive.

---

## 4 — Create the iOS App Target

1. `File → New → Target → iOS → App`
2. **Product Name**: `SakanHub`
3. **Team**: your Apple Developer team
4. **Bundle Identifier**: `com.sakanhub.app` (change now if the final one is different — you cannot rename after App Store Connect registration)
5. **Interface**: SwiftUI · **Life Cycle**: SwiftUI App · **Language**: Swift
6. Uncheck "Include Tests" (add a test target later)
7. Delete Xcode's auto-generated `ContentView.swift` + `SakanHubApp.swift` from the new target — the real ones live at `ios/SakanHub/SakanHub/App/*.swift`
8. Right-click the new target → Add Files to Project → select the folder `ios/SakanHub/SakanHub/` → **Create folder references** (not groups). This includes every existing `.swift` + `Assets.xcassets` + `PrivacyInfo.xcprivacy`.

---

## 5 — Add the SPM package as a dependency

The SPM `Package.swift` at `ios/SakanHub/Package.swift` is the LIBRARY. In the app target:

1. `File → Add Package Dependencies…`
2. Select "Add Local…" → point at `ios/SakanHub/`
3. Add the `SakanHub` library to the app target.

Alternatively, add the individual files directly (already done in step 4). Either path works — SPM is preferred when you want Xcode to manage `lottie-spm`.

---

## 6 — Wire the xcconfig files

The four files under `ios/SakanHub/Config/` (`Shared`, `Development`, `Staging`, `Production`) drive per-scheme variables.

1. `File → Add Files to Project…` → select all four `.xcconfig` files. Do **not** copy.
2. Click the project (blue icon) → `Info` tab → `Configurations`. You will see Debug + Release by default. Add a third called **Staging**:
   - Debug   → `Development.xcconfig`
   - Staging → `Staging.xcconfig`
   - Release → `Production.xcconfig`
3. Verify: `Build Settings → All → search API_BASE_URL`. Each configuration must show the value from its `.xcconfig`.

Refer to `ios/SakanHub/Config/README.md` if a substitution shows `$(API_BASE_URL)` literally at build time.

---

## 7 — Create three schemes

`Product → Scheme → Manage Schemes… → +` (one at a time):

| Scheme               | Build configuration | Purpose |
|---|---|---|
| `SakanHub Dev`       | Debug (`Development`)   | Local backend on your Mac |
| `SakanHub Staging`   | Staging                  | Real backend, sandbox PSP |
| `SakanHub Prod`      | Release (`Production`)   | Archive → TestFlight only |

Enable **Shared** on each so they are committed alongside the project.

---

## 8 — Configure Info.plist

Xcode's target may auto-generate an Info.plist. Delete it and point the target at the real one:

- Target → Build Settings → `Info.plist File` → `ios/SakanHub/SakanHub/Info.plist`
- Target → Build Settings → `Generate Info.plist File` → **No**

Verify all the permission strings are present:
`NSCameraUsageDescription`, `NSMotionUsageDescription`,
`NSLocationWhenInUseUsageDescription`, `UIRequiredDeviceCapabilities` includes `arkit`.

---

## 9 — Bundle Identifier + Signing & Capabilities

Under the target's **Signing & Capabilities** tab:

- **Team**: your Apple Developer team
- **Bundle Identifier**: `com.sakanhub.app` (matches the value in `Shared.xcconfig`)
- **Signing**: Automatic
- **Provisioning Profile**: Automatic
- **Capabilities** to add now:
  - (none required for Day 1)
  - Add **Push Notifications** later if you wire APN
  - Add **Sign in with Apple** later if any social login is added
  - Add **Associated Domains** later for Universal Links

---

## 10 — Privacy Manifest

- Verify `ios/SakanHub/SakanHub/Resources/PrivacyInfo.xcprivacy` is included in the app target (right-hand pane → **Target Membership** ticked).
- Mirror the data types in App Store Connect → App Privacy when the app record exists (see `docs/DATA_INVENTORY.md`).

---

## 11 — App Icon (placeholder allowed for Day 1)

- `ios/SakanHub/SakanHub/Resources/Assets.xcassets/AppIcon.appiconset/` currently contains only a README.
- For Day 1 a placeholder single-colour 1024×1024 PNG is fine — save it as `AppIcon-1024.png` in that folder.
- Before App Store Archive, replace it with the final 1024×1024 PNG (no alpha channel, no transparency).

---

## 12 — First Build (Simulator)

1. Top of Xcode: select **SakanHub Dev** scheme + **iPhone 15 Pro** simulator.
2. `Product → Build` (`⌘B`).
3. Fix any red errors — the top three common ones are in the Troubleshooting section below.
4. `Product → Run` (`⌘R`). The app should launch, show the splash, then the Auth screen.

Simulator cannot verify:
- ARKit (needs device)
- Location (fake location works but AR uses live device motion)
- Real OTP (SMS provider is dev-only; the code is printed in the backend log)

---

## 13 — First Run (physical iPhone)

1. Connect the iPhone via USB, trust the certificate.
2. Xcode → top bar → destination → your device.
3. `Product → Run` (`⌘R`).
4. First run on any given device asks you to trust the developer profile: `Settings → General → VPN & Device Management` on the phone → tap your profile → Trust.

If the app launches but the backend is unreachable, the phone cannot see `localhost` on your Mac. Use the Mac's LAN IP:

- Edit `Development.xcconfig` → `API_BASE_URL = http:/$()/<mac-lan-ip>:4000`
- Rebuild + rerun

Or spin up staging and switch to the Staging scheme.

---

## 14 — Configure Staging API (when available)

- Edit `Staging.xcconfig` → set `API_BASE_URL = https:/$()/staging.sakanhub.example`
- Ensure the staging backend serves valid HTTPS
- Use the **SakanHub Staging** scheme for on-device work; **never** ship Staging to TestFlight

---

## 15 — Smoke tests (with the backend running)

Run each in order. All must pass before Archive.

### 15.1 Authentication (OTP + JWT)
1. Launch the app on the phone with the **Dev** scheme + backend on your Mac.
2. Enter phone `+9665XXXXXXXX` → tap "Send code".
3. Read the printed code from the backend terminal (`[otp] +9665… → 123456 (dev)`).
4. Enter the code → verify. You should land on the app's Home tab and `/v1/auth/me` should have been called.

### 15.2 Property browse
1. Home tab loads the seeded properties (verified by hitting `/v1/properties`).
2. Tap a listing → detail view opens without error.
3. Availability strip shows blocked / free days for that property.

### 15.3 Booking
1. On a daily-rental property, pick check-in + check-out.
2. Backend `/v1/quote` fills the fee/VAT/total lines. **All numbers must come from the server**, not the app.
3. Tap Confirm → backend `/v1/bookings` returns a booking + quote. Booking status = `draft` at this point (payment step is next).

### 15.4 Payment (Sandbox PSP)
1. Start checkout → `/v1/payments` returns a sandbox `redirectUrl` (`sandbox://checkout/...`).
2. From the backend's Node REPL or another terminal, simulate the webhook:
   ```bash
   node -e "const s = require('./backend/dist/providers/sandbox.js'); \
     const evt = s.simulateCapture('<providerPaymentId>'); \
     console.log(s.signWebhook(evt));"
   # then POST that body to /v1/payments/webhook with X-Sandbox-Signature
   ```
3. In the app, refresh the booking. Status should now read `confirmed`.

### 15.5 Wallet / Settlement
1. On the Host account (log in with the seed host phone), open the Wallet tab.
2. Available / Pending / Paid / Total must match `GET /v1/wallet` verbatim.
3. Any settlement rows appear from `GET /v1/settlements`.

### 15.6 Refund
1. As an admin (log in with the seed admin phone) or host, open the payment detail.
2. Tap "Request refund" → optional amount + reason.
3. `/v1/payments/:id/refund` returns `completed`; ledger reverses. Wallet updates on refresh.

### 15.7 Account deletion (Apple 5.1.1(v))
1. Settings → Account → Delete Account.
2. Type `DELETE`, submit.
3. Backend anonymises the row, revokes tokens; the app signs the user out. Attempting to sign back in with the same phone number treats them as a new user.

### 15.8 ARKit
1. On a property with ARKit-suitable content, open the AR view.
2. Camera permission prompt appears (uses `NSCameraUsageDescription`).
3. ARKit initialises without crash; the property overlay renders in the real camera feed.

---

## 16 — Archive (before TestFlight)

Do NOT archive with the Dev or Staging scheme.

1. Top of Xcode → select **Any iOS Device** target.
2. Switch to the **SakanHub Prod** scheme.
3. `Product → Archive`.
4. Organizer opens → Distribute App → App Store Connect → Upload.
5. If Xcode reports missing entitlements or a missing capability, resolve in Signing & Capabilities and re-Archive.

The Production build hard-forces `useMocks=false` and asserts HTTPS at first URL read — the assertion fires on launch. Anything mock-flavoured slipping into a Production build will crash immediately.

---

## 17 — TestFlight

1. App Store Connect → your app → TestFlight tab.
2. Wait ~15 min for the "Processing" spinner to finish.
3. Fill in the Test Information (feedback email, description, Arabic + English).
4. Add internal testers (up to 100 team members) — instant.
5. Add external testers → submits for Beta App Review (first submission ≤ 24h).

---

## Things that must NOT be placed in iOS

**Under any circumstance, no build (Dev / Staging / Prod), no scheme, no xcconfig, no `Info.plist`, no Swift file may contain:**

- `TAP_SECRET_KEY` — Tap server secret. Server-side only.
- `TAP_WEBHOOK_SECRET` — Tap webhook HMAC secret. Server-side only.
- Any Moyasar secret key or webhook secret. Server-side only.
- `JWT_SECRET` — the token issuer's signing secret. Server-side only. iOS only ever holds the *issued* access + refresh tokens, in the Keychain.
- Database credentials (Postgres user / password / DSN).
- SMS provider secret (Unifonic / Twilio / Sinch).
- ZATCA cryptographic stamp private key or Public Key onboarding secret.
- Any other production server secret, cloud storage access key, or internal API key.

If a design decision seems to require a secret on the device, the design is wrong: route the call through the SakanHub backend instead.

---

## External accounts required

Beyond the Mac + Xcode setup, the following external contracts / accounts must exist before Production. None are needed for Day 1 on the simulator or the developer's own device using the sandbox stack.

| # | Provider / Authority | Purpose | Blocks |
|---|---|---|---|
| 1 | **Apple Developer Program** | App signing, provisioning, TestFlight, App Store | Everything past step 12 on a real device |
| 2 | **Payment Provider** (Tap or Moyasar) | Real card charges, webhooks, refunds, payouts | Production payment flow |
| 3 | **REGA** (هيئة العقار) | Electronic Real Estate Platform license | Legal operation in KSA |
| 4 | **Nafath** (Elm) | Advertiser identity verification | REGA advertisement rules |
| 5 | **ZATCA** (فاتورة Phase 2) | Signed e-invoices | Regulatory tax compliance |
| 6 | **Domain + DNS** | `sakanhub.com`, `api.sakanhub.com`, `staging.…` | Public routing |
| 7 | **SSL/TLS** | Let's Encrypt or Cloudflare | HTTPS enforcement (Production build asserts) |
| 8 | **Object storage** | S3-compatible bucket for media + KYC + invoices | Media upload beyond sandbox |
| 9 | **SMS provider** (Unifonic / Twilio) | OTP delivery | Real production authentication |
| 10 | **Monitoring** (Sentry + Uptime + Grafana) | Error tracking + uptime + observability | Post-launch operations |

See `docs/PRODUCTION_INFRASTRUCTURE_CHECKLIST.md` for the full list.

---

## First Mac Build troubleshooting

### Package resolution
- Symptom: Xcode spins on "Resolving package graph".
- Fixes:
  - `File → Packages → Reset Package Caches`
  - `File → Packages → Resolve Package Versions`
  - `Product → Clean Build Folder` (`⌘⇧K`)
  - Delete `~/Library/Developer/Xcode/DerivedData/*` if the spinner never ends

### Signing
- Symptom: "No signing certificate found" or "Provisioning profile doesn't match".
- Fixes:
  - Signing & Capabilities → set Team to your Apple Developer team
  - Uncheck then re-check "Automatically manage signing"
  - `Xcode → Settings → Accounts → Download Manual Profiles`

### Bundle Identifier
- Symptom: "The bundle identifier is not available. Please enter a unique string."
- Fixes:
  - Your team already owns another app with the same identifier — choose something like `com.sakanhub.app.dev` for local testing
  - Register the final identifier in App Store Connect before archive, not before Day 1

### Info.plist
- Symptom: "Multiple commands produce Info.plist" or the app crashes on launch with a permission-string error.
- Fixes:
  - Build Settings → `Generate Info.plist File` = No
  - `Info.plist File` = `ios/SakanHub/SakanHub/Info.plist`
  - Make sure Xcode's auto-generated `Info.plist` (in the target folder) is deleted

### xcconfig
- Symptom: `AppEnvironment.apiBaseURL` prints the literal `$(API_BASE_URL)` at runtime.
- Fixes:
  - Verify each configuration is bound to its `.xcconfig` under Project → Info → Configurations
  - Verify Build Settings → All → `API_BASE_URL` shows a value, not `Multiple Values`
  - Rebuild after any xcconfig change (Xcode caches env vars aggressively)

### Privacy Manifest
- Symptom: App Store rejects: "Missing PrivacyInfo.xcprivacy" or "Data-collection mismatch".
- Fixes:
  - Confirm `PrivacyInfo.xcprivacy` is a member of the app target (Target Membership tick)
  - Mirror its declared `NSPrivacyCollectedDataTypes` in App Store Connect → App Privacy
  - Add reason APIs (`UserDefaults`, `FileTimestamp`) — already present in the current file

### Assets
- Symptom: "App Icon set 'AppIcon' has no 1024×1024 image".
- Fixes:
  - Drop `AppIcon-1024.png` into `Assets.xcassets/AppIcon.appiconset/`
  - Must be 1024×1024, PNG, no alpha channel, no transparency
  - For Day 1 a placeholder is acceptable — App Store review requires the final art

### API_BASE_URL / on-device connectivity
- Symptom: OTP request fails on the phone but works on the simulator.
- Fixes:
  - Simulator can hit `http://localhost:4000`; the phone cannot
  - Use the Mac's LAN IP (`ipconfig getifaddr en0`) in `Development.xcconfig`
  - Backend must be listening on `0.0.0.0` (already the case — `app.listen({host: '0.0.0.0'})`)
  - Both devices must be on the same Wi-Fi
  - If macOS firewall blocks the port: `System Settings → Network → Firewall → allow node`

### ATS / HTTPS
- Symptom: "The resource could not be loaded because the App Transport Security policy requires the use of a secure connection".
- Fixes for LOCAL DEV ONLY:
  - Keep `API_BASE_URL = http://<mac-ip>:4000` in `Development.xcconfig`
  - Add a NSAppTransportSecurity exception for the Mac's LAN IP in `Info.plist` — remove before merging
- Fixes for STAGING/PROD:
  - Only HTTPS URLs. No exceptions.
  - Fix the certificate on the backend host instead

### Architecture
- Symptom: "The linked library 'X' is missing one or more architectures required by this target: arm64" (or x86_64 for simulator).
- Fixes:
  - `Product → Clean Build Folder`
  - Confirm `Build Settings → Excluded Architectures → Any iOS Simulator SDK` is empty (Apple Silicon Macs handle this natively)

### iOS deployment target
- Symptom: "'someAPI' is only available in iOS 17.0 or newer".
- Fixes:
  - Deployment Target is iOS 16 (see `Shared.xcconfig`)
  - Either raise the target to iOS 17 (breaks older devices) or guard the call with `if #available(iOS 17, *)`

---

## Do NOT (during Day 1)

- Do not commit a real App Icon while testing on a personal device — replace later
- Do not add any real PSP secret to any xcconfig
- Do not archive with the Dev or Staging scheme
- Do not push to `main` without a PR — stay on `claude/web-app-airpnp-dn3mvr`
- Do not disable ATS in `Info.plist` for anything other than the Mac's LAN IP
