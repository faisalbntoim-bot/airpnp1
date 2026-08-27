import SwiftUI

enum Theme {
    // Brand colours (aligned with the سكن هوب web app)
    static let accent      = Color(hex: 0x2E9E77)   // primary green
    static let accentDeep  = Color(hex: 0x0C4C3A)   // deep green
    static let sage        = Color(hex: 0x6FBF9A)   // sage
    static let gold        = Color(hex: 0xC7A252)   // gold accents
    static let ink         = Color(hex: 0x0F1E18)   // text
    static let bg          = Color(hex: 0xF3F6F3)   // background
    static let bg2         = Color(hex: 0xE7EFE9)   // subtle background
    static let paper       = Color.white            // cards
    static let line        = Color(hex: 0xDEE8E1)   // borders
    static let textDim     = Color(hex: 0x6C7B73)   // secondary text

    // Daily-mode warm palette
    static let daily       = Color(hex: 0xE8912F)
    static let dailyLight  = Color(hex: 0xFFD37A)

    // Typography
    static func heading(_ size: CGFloat, weight: Font.Weight = .black) -> Font {
        Font.system(size: size, weight: weight, design: .default)
    }
    static func body(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        Font.system(size: size, weight: weight, design: .default)
    }

    // Shape metrics
    static let cardRadius: CGFloat = 18
    static let chipRadius: CGFloat = 14
    static let btnRadius:  CGFloat = 13

    // Shadows
    static let cardShadow = Shadow(color: .black.opacity(0.08), radius: 12, x: 0, y: 4)
    static let popShadow  = Shadow(color: .black.opacity(0.18), radius: 22, x: 0, y: 10)

    struct Shadow { let color: Color; let radius: CGFloat; let x: CGFloat; let y: CGFloat }
}

extension View {
    func shadow(_ s: Theme.Shadow) -> some View {
        shadow(color: s.color, radius: s.radius, x: s.x, y: s.y)
    }
}

extension Color {
    init(hex: UInt32, alpha: Double = 1) {
        self.init(
            .sRGB,
            red:   Double((hex >> 16) & 0xff) / 255.0,
            green: Double((hex >>  8) & 0xff) / 255.0,
            blue:  Double( hex        & 0xff) / 255.0,
            opacity: alpha
        )
    }
}
