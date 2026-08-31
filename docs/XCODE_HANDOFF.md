# SakanHub — Xcode Handoff

Everything to do the first real iOS build on a Mac. Follow top-to-bottom.
None of these steps can be performed inside the current Linux container.

## 0 — Prerequisites

- macOS 14.5+
- Xcode 15.3+
- A physical iPhone (ARKit does not run in the simulator)
- Apple Developer Program membership + Team ID

## 1 — Fetch the repo on the Mac

```bash
git clone https://github.com/faisalbntoim-bot/airpnp1.git
cd airpnp1/ios/SakanHub
```

## 2 — Open the workspace

```bash
open Package.swift
```

Xcode opens the SPM package. **This alone will NOT produce a distributable
app** — it's a library target. You need an app target.

## 3 — Create the app target

1. `File → New → Target → App` · iOS · SwiftUI · Language: Swift.
2. Product Name: `SakanHub`.
3. Team: your Apple Developer team.
4. Bundle Identifier: `com.sakanhub.app` (or your final identifier).
5. Interface: SwiftUI · Life Cycle: SwiftUI App.
6. **Uncheck** "Include Tests" for now (add test target later).
7. Delete the auto-generated `ContentView.swift` and `SakanHubApp.swift`
   in the new target — the real ones are already in
   `ios/SakanHub/SakanHub/App/SakanHubApp.swift` and
   `ios/SakanHub/SakanHub/App/RootView.swift`.
8. Add all folders under `ios/SakanHub/SakanHub/` to the new app target
   (right-click target → Add Files, select the folder, tick
   "Create folder references" NOT "groups").

## 4 — Wire xcconfig files

1. Add the four files under `ios/SakanHub/Config/` to the project
   (`File → Add Files to Project…`, do NOT copy).
2. Project settings → Info → Configurations:
   - Debug     → `Development.xcconfig`
   - Staging   → `Staging.xcconfig` (create this configuration first)
   - Release   → `Production.xcconfig`
3. Verify each configuration inherits its file (open Build Settings and
   confirm `API_BASE_URL` shows the expected value per configuration).

## 5 — Create three schemes

1. `Product → Scheme → Manage Schemes… → +` for each of:
   - `SakanHub Dev`      → Debug build configuration
   - `SakanHub Staging`  → Staging build configuration
   - `SakanHub Prod`     → Release build configuration
2. Enable "Shared" on each so they are committed with the project.
3. For Prod: `Edit Scheme → Build → Post-actions` — optional automation.

## 6 — Info.plist

Xcode may create an auto-generated Info.plist for the new target. Delete
it and set:

- Project settings → Build Settings → `Info.plist File` →
  `ios/SakanHub/SakanHub/Info.plist`

Verify at build time that the `API_BASE_URL` and `USE_MOCKS` placeholders
resolve to values (open the built `.app`'s `Info.plist` in Finder or the
in-app `AppEnvironment.apiBaseURL` at first read).

## 7 — Signing & Capabilities

Under the target's Signing & Capabilities tab:

1. Team: your Apple Developer team.
2. Signing: Automatic.
3. Provisioning: Automatic.
4. Add capabilities as needed:
   - Push Notifications (if enabled)
   - Sign in with Apple (if enabled)
   - Background Modes → Location if AR needs it (usually not for WhenInUse)
   - Associated Domains (`applinks:sakanhub.com`) for Universal Links (optional)

## 8 — Privacy Manifest

- Verify `ios/SakanHub/SakanHub/Resources/PrivacyInfo.xcprivacy` is
  included in the app target ("Membership" tick).
- App Store Connect → App Privacy → fill in the same data types
  declared in the manifest (see `docs/DATA_INVENTORY.md`).

## 9 — App Icon

Drop the final `AppIcon-1024.png` (1024×1024, no alpha, no transparency)
into `ios/SakanHub/SakanHub/Resources/Assets.xcassets/AppIcon.appiconset/`
before Archive. iOS 14+ derives every smaller size from the 1024 master.

## 10 — First build (Simulator)

```bash
# From inside Xcode:
Product → Build     (⌘B)
```

Fix any red errors. The compile-time invariants in `AppEnvironment`
(preconditionFailure on missing `API_BASE_URL` in Production) fire at
first URL access, not at compile time, so a Prod build without the
xcconfig set will link fine but crash on launch — this is intentional.

## 11 — First run (physical iPhone)

1. Connect the iPhone via USB, trust the certificate.
2. Product → Destination → your device.
3. Product → Run (⌘R).
4. Verify:
   - App launches without crash
   - OTP flow reaches your dev backend (`http://localhost:4000` via
     device on the same LAN; use `<mac IP>` instead of `localhost` if
     testing on the phone)
   - AR view opens the camera and asks for permission

## 12 — Backend + iOS end-to-end smoke test

On the Mac in parallel:

```bash
cd airpnp1/backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run dev
```

Then in the app:

1. Sign in via OTP with `+966500000001` (seeded host).
2. Read the code from `npm run dev`'s log.
3. Verify `/v1/auth/me` returns the user (Xcode debugger network log).
4. Browse properties, request a quote, complete a sandbox checkout.

## 13 — Archive (before TestFlight)

1. Select the Any iOS Device target (top of Xcode).
2. Product → Archive.
3. Wait; the Organizer window opens.
4. Distribute App → App Store Connect → Upload.
5. Xcode signs and uploads. First upload is often rejected on missing
   privacy strings — read the Xcode error, fix, re-Archive.

## 14 — TestFlight

1. App Store Connect → your app → TestFlight tab.
2. Wait for the "Processing" spinner to finish (~15 min).
3. Fill in "Test Information" (feedback email, description).
4. Add internal testers (up to 100 team members, instant).
5. Add external testers → submits for Beta App Review (~24h first time).

## 15 — Do NOT

- Do not commit `.xcodeproj` or `.xcworkspace` state to `main` before
  reviewing signing settings — they carry your Team ID.
- Do not upload a build with `USE_MOCKS=YES` in the Info.plist.
- Do not archive without the `PRODUCTION` compile flag on the Release
  configuration — the runtime HTTPS assertion won't fire without it.
- Do not upload placeholder screenshots or icon — App Store rejects.

## 16 — When this document goes stale

Update whenever any of these change:
- Bundle identifier
- Xcconfig variable names or presence
- Info.plist keys
- Privacy Manifest content
- Backend base URL for staging or production
