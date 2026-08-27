import SwiftUI

// MARK: - Primary/Secondary buttons

struct PrimaryButton: View {
    let title: String
    var systemImage: String? = nil
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let s = systemImage { Image(systemName: s) }
                Text(title)
            }
            .font(Theme.body(15, weight: .heavy))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 48)
            .background(
                LinearGradient(colors: [Theme.accent, Theme.accentDeep],
                               startPoint: .topLeading, endPoint: .bottomTrailing),
                in: RoundedRectangle(cornerRadius: Theme.btnRadius, style: .continuous)
            )
            .shadow(Theme.cardShadow)
        }
        .buttonStyle(.plain)
    }
}

struct GhostButton: View {
    let title: String
    var systemImage: String? = nil
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let s = systemImage { Image(systemName: s) }
                Text(title)
            }
            .font(Theme.body(14, weight: .heavy))
            .foregroundStyle(Theme.accentDeep)
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(Theme.bg2, in: RoundedRectangle(cornerRadius: Theme.btnRadius, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Empty & loading

struct EmptyStateView: View {
    var icon: String = "tray"
    var title: String
    var subtitle: String? = nil

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(Theme.textDim)
            Text(title).font(Theme.heading(15, weight: .heavy)).foregroundStyle(Theme.ink)
            if let s = subtitle {
                Text(s).font(Theme.body(12)).foregroundStyle(Theme.textDim).multilineTextAlignment(.center)
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity)
    }
}

struct LoadingView: View {
    var body: some View {
        VStack(spacing: 10) {
            LottieLoadingView()
            Text("جاري التحميل…").font(Theme.body(12)).foregroundStyle(Theme.textDim)
        }
        .padding(24)
    }
}

// MARK: - Chip

struct Chip: View {
    let text: String
    var systemImage: String? = nil
    var active: Bool = false
    var body: some View {
        HStack(spacing: 5) {
            if let s = systemImage { Image(systemName: s).font(.system(size: 12, weight: .heavy)) }
            Text(text).font(.system(size: 12, weight: .heavy))
        }
        .padding(.horizontal, 12).padding(.vertical, 7)
        .background(active ? Theme.accent : Theme.paper, in: Capsule())
        .foregroundStyle(active ? .white : Theme.ink)
        .overlay(Capsule().stroke(active ? .clear : Theme.line, lineWidth: 1))
    }
}

// MARK: - Section header

struct SectionHeader: View {
    let title: String
    var hint: String? = nil
    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Rectangle()
                .fill(LinearGradient(colors: [Theme.accent, Theme.accentDeep], startPoint: .top, endPoint: .bottom))
                .frame(width: 3, height: 14)
                .clipShape(Capsule())
            Text(title).font(Theme.heading(14, weight: .heavy)).foregroundStyle(Theme.ink)
            if let h = hint {
                Text(h).font(.system(size: 10, weight: .heavy)).foregroundStyle(Theme.textDim)
            }
            Spacer()
        }
    }
}
