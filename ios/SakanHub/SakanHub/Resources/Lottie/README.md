# Lottie animations

Place your `.json` animations here, using these names:

| File                    | Where it's used                                   |
|-------------------------|---------------------------------------------------|
| `splash.json`           | `LottieSplashView` — launch/splash screen         |
| `loading.json`          | `LottieLoadingView` — global loading indicator    |
| `like.json`             | `LottieLikeView` — heart tap animation            |
| `save.json`             | Bookmark animation                                |
| `success.json`          | `LottieSuccessView` — generic success confirmation |
| `booking_success.json`  | `LottieBookingSuccessView` — after a booking      |

## Where to get animations
- <https://lottiefiles.com> — search "house", "map", "like", "success"
- Airbnb's own examples: <https://github.com/airbnb/lottie-ios/tree/master/Examples>

## Behaviour when files are missing
`LottieView` falls back to a lightweight SwiftUI pulse + SF Symbol so the UI
still works even if no JSON file is present. Add real files as they are
prepared — no code changes needed.
