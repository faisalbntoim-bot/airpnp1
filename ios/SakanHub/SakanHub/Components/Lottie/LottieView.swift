import SwiftUI

/// Thin safe wrapper around Lottie's `LottieView` from the `lottie-spm` package:
///     https://github.com/airbnb/lottie-spm.git
///
/// If the package is not linked, or the animation file is missing from the bundle,
/// this view degrades gracefully to a lightweight SwiftUI fallback — no crash.
///
/// Add JSON animations to `Resources/Lottie/` and reference them by name only
/// (without the `.json` extension), e.g. `LottieView(name: "splash")`.
struct LottieView: View {
    let name: String
    var loopMode: LoopMode = .loop
    var speed: CGFloat = 1
    var contentMode: ContentMode = .fit
    /// Auto-triggered on `onAppear`; useful for one-shot animations.
    var autoPlay: Bool = true

    enum LoopMode { case playOnce, loop, autoReverse }

    var body: some View {
        Group {
            #if canImport(Lottie)
            _LottieImpl(name: name, loopMode: loopMode, speed: speed, contentMode: contentMode, autoPlay: autoPlay)
            #else
            FallbackAnimation(name: name)
            #endif
        }
        // Never let a missing asset break layout.
        .accessibilityHidden(true)
    }
}

#if canImport(Lottie)
import Lottie

private struct _LottieImpl: UIViewRepresentable {
    let name: String
    let loopMode: LottieView.LoopMode
    let speed: CGFloat
    let contentMode: ContentMode
    let autoPlay: Bool

    func makeUIView(context: Context) -> UIView {
        let container = UIView(frame: .zero)
        container.backgroundColor = .clear
        guard let anim = LottieAnimation.named(name) else {
            // Bundle miss → return an empty view (fallback layer handled by SwiftUI parent).
            return container
        }
        let av = LottieAnimationView(animation: anim)
        av.translatesAutoresizingMaskIntoConstraints = false
        av.contentMode = (contentMode == .fill) ? .scaleAspectFill : .scaleAspectFit
        av.animationSpeed = speed
        switch loopMode {
        case .playOnce:    av.loopMode = .playOnce
        case .loop:        av.loopMode = .loop
        case .autoReverse: av.loopMode = .autoReverse
        }
        container.addSubview(av)
        NSLayoutConstraint.activate([
            av.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            av.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            av.topAnchor.constraint(equalTo: container.topAnchor),
            av.bottomAnchor.constraint(equalTo: container.bottomAnchor)
        ])
        if autoPlay { av.play() }
        return container
    }

    func updateUIView(_ uiView: UIView, context: Context) {}
}
#endif

/// Plain SwiftUI stand-in when Lottie is unavailable — keeps the UI shape.
private struct FallbackAnimation: View {
    let name: String
    @State private var pulse = false
    var body: some View {
        ZStack {
            Circle()
                .stroke(Theme.accent.opacity(0.25), lineWidth: 3)
                .scaleEffect(pulse ? 1.15 : 0.75)
                .opacity(pulse ? 0.0 : 1.0)
                .animation(.easeInOut(duration: 1.6).repeatForever(autoreverses: false), value: pulse)
            Image(systemName: iconForName(name))
                .font(.system(size: 34, weight: .bold))
                .foregroundStyle(Theme.accent)
        }
        .onAppear { pulse = true }
    }

    private func iconForName(_ n: String) -> String {
        switch n {
        case "splash":            return "building.2.crop.circle.fill"
        case "loading":           return "arrow.triangle.2.circlepath"
        case "like":              return "heart.fill"
        case "save":              return "bookmark.fill"
        case "success":           return "checkmark.seal.fill"
        case "booking_success":   return "calendar.badge.checkmark"
        default:                  return "sparkles"
        }
    }
}
