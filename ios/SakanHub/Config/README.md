# Xcode build configurations

Three `.xcconfig` files feed one `Info.plist` and three schemes. Do NOT
commit real secrets to any of these files — payment / provider secrets
live only on the backend.

## Schemes to create in Xcode

| Scheme       | Base config          | API_BASE_URL                              | USE_MOCKS | Compile flag  |
|--------------|----------------------|-------------------------------------------|-----------|---------------|
| Development  | `Development.xcconfig` | `http://localhost:4000`                | `YES`     | `DEBUG`       |
| Staging      | `Staging.xcconfig`     | `https://staging.sakanhub.example`     | `NO`      | `STAGING`     |
| Production   | `Production.xcconfig`  | `https://api.sakanhub.example`         | `NO`      | `PRODUCTION`  |

## How to attach in Xcode

1. Create the app target (**File → New → Target → App**, iOS 16+, SwiftUI).
2. Add the three `.xcconfig` files (**File → Add Files to Project…**).
3. **Project → Info → Configurations**: assign each configuration
   (Debug/ReleaseStaging/Release) to its corresponding `.xcconfig`.
4. Create three schemes and pin each to its build configuration.
5. Verify `API_BASE_URL` shows up in `Info.plist` at build time via the
   `$(API_BASE_URL)` substitution already in place.

## Security invariants

- `PRODUCTION` compile flag is the **only** way to guarantee mocks are
  unreachable — `RepositoryFactory` and `AppEnvironment` both branch on it.
- `AppEnvironment.apiBaseURL` asserts `scheme == https` when built with
  `PRODUCTION`; a Production build with an HTTP URL crashes on first read.
- Secrets: never in xcconfig, never in Info.plist, never in source.
  All PSP secrets live on the backend server.
