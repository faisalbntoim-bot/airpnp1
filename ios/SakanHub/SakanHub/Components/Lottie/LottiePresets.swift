import SwiftUI

/// Convenience presets — safe wrappers over `LottieView`.
/// All fall back to a SwiftUI shape if the JSON is missing.

struct LottieSplashView: View {
    var name: String = "splash"
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Theme.accent, Theme.accentDeep],
                startPoint: .topLeading, endPoint: .bottomTrailing
            ).ignoresSafeArea()
            VStack(spacing: 16) {
                LottieView(name: name, loopMode: .playOnce)
                    .frame(width: 160, height: 160)
                Text("سكن هوب")
                    .font(Theme.heading(30, weight: .black))
                    .foregroundStyle(.white)
                Text("عقارك بأسلوب جديد")
                    .font(Theme.body(13, weight: .medium))
                    .foregroundStyle(.white.opacity(0.8))
            }
        }
    }
}

struct LottieLoadingView: View {
    var name: String = "loading"
    var body: some View {
        LottieView(name: name).frame(width: 80, height: 80)
    }
}

struct LottieLikeView: View {
    var name: String = "like"
    @Binding var isLiked: Bool
    var body: some View {
        Button { isLiked.toggle() } label: {
            ZStack {
                LottieView(name: name, loopMode: .playOnce, autoPlay: isLiked)
                    .frame(width: 44, height: 44)
                Image(systemName: isLiked ? "heart.fill" : "heart")
                    .foregroundStyle(isLiked ? .pink : .white)
                    .font(.system(size: 20, weight: .bold))
                    .shadow(radius: 3)
                    .opacity(isLiked ? 0 : 1) // hide when Lottie takes over
            }
        }
        .buttonStyle(.plain)
    }
}

struct LottieSuccessView: View {
    var title: String = "تم بنجاح"
    var body: some View {
        VStack(spacing: 8) {
            LottieView(name: "success", loopMode: .playOnce)
                .frame(width: 120, height: 120)
            Text(title)
                .font(Theme.heading(17, weight: .black))
                .foregroundStyle(Theme.ink)
        }
    }
}

struct LottieBookingSuccessView: View {
    var title: String = "تم إرسال طلب الحجز"
    var subtitle: String = "بانتظار تأكيد المضيف"
    var body: some View {
        VStack(spacing: 6) {
            LottieView(name: "booking_success", loopMode: .playOnce)
                .frame(width: 140, height: 140)
            Text(title).font(Theme.heading(17, weight: .black)).foregroundStyle(Theme.ink)
            Text(subtitle).font(Theme.body(12)).foregroundStyle(Theme.textDim)
        }
    }
}
