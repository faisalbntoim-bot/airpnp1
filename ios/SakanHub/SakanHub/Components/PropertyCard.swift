import SwiftUI

/// Full-bleed feed card (TikTok/Airbnb-inspired).
struct PropertyCard: View {
    let property: Property
    var isSaved: Bool = false
    var isLiked: Bool = false
    var onLike: () -> Void = {}
    var onSave: () -> Void = {}
    var onShare: () -> Void = {}
    var onOpenDetail: () -> Void = {}
    var onOpenMap: () -> Void = {}
    var onOpenAR: () -> Void = {}
    var onOpenTour: () -> Void = {}

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            AsyncImage(url: property.media.first?.url) { phase in
                switch phase {
                case .success(let img):
                    img.resizable().scaledToFill()
                default:
                    LinearGradient(
                        colors: [Theme.accentDeep, Theme.accent.opacity(0.6)],
                        startPoint: .top, endPoint: .bottom
                    )
                }
            }
            .clipped()

            LinearGradient(
                colors: [.clear, .black.opacity(0.45), .black.opacity(0.7)],
                startPoint: .center, endPoint: .bottom
            )
            .allowsHitTesting(false)

            VStack(alignment: .trailing, spacing: 10) {
                Spacer()
                categoryChip
                titleBlock
                specsLine
                priceRow
                actionsRow
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .onTapGesture(count: 2) { onLike() }
        .onTapGesture { onOpenDetail() }
    }

    private var categoryChip: some View {
        Text("\(categoryEmoji) \(property.category.rawValue)")
            .font(.system(size: 11, weight: .heavy))
            .foregroundStyle(Theme.ink)
            .padding(.horizontal, 10).padding(.vertical, 4)
            .background(.thickMaterial, in: Capsule())
    }

    private var titleBlock: some View {
        HStack(spacing: 4) {
            Text(property.title)
                .font(Theme.heading(18, weight: .black))
                .foregroundStyle(.white)
                .lineLimit(2)
            if property.purpose == .daily {
                Text("· إيجار يومي")
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundStyle(Theme.dailyLight)
            }
        }
    }

    private var specsLine: some View {
        HStack(spacing: 6) {
            Text("\(Int(property.areaSquareMeters)) م²").bold()
            if let r = property.rooms { dot; Text("\(r) غرف") }
            if let b = property.bathrooms { dot; Text("\(b) حمام") }
        }
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(.white.opacity(0.9))
    }

    private var priceRow: some View {
        HStack(alignment: .lastTextBaseline) {
            if property.purpose == .daily, let d = property.dailyRateSAR {
                Text("\(Int(d))")
                    .font(Theme.heading(24, weight: .black))
                    .foregroundStyle(LinearGradient(
                        colors: [Theme.dailyLight, Theme.daily],
                        startPoint: .leading, endPoint: .trailing))
                Text("ر.س / ليلة").font(.system(size: 11, weight: .heavy))
                    .foregroundStyle(Theme.dailyLight)
            } else {
                Text("\(Int(property.priceSAR))")
                    .font(Theme.heading(24, weight: .black))
                    .foregroundStyle(.white)
                Text("ر.س / \(property.purpose == .rent ? "سنويًا" : "")")
                    .font(.system(size: 11, weight: .heavy))
                    .foregroundStyle(.white.opacity(0.85))
            }
        }
    }

    private var actionsRow: some View {
        HStack(spacing: 10) {
            IconAction(system: "square.and.arrow.up.fill", action: onShare)
            IconAction(system: isSaved ? "bookmark.fill" : "bookmark", action: onSave)
                .foregroundStyle(isSaved ? Theme.gold : .white)
            IconAction(system: isLiked ? "heart.fill" : "heart", action: onLike)
                .foregroundStyle(isLiked ? .pink : .white)
            IconAction(system: "map.fill", action: onOpenMap)
            IconAction(system: "arkit", action: onOpenAR)
            IconAction(system: "vr.slash", action: onOpenTour)
            Spacer()
            Button(action: onOpenDetail) {
                Label("التفاصيل", systemImage: "chevron.left")
                    .labelStyle(.titleOnly)
                    .font(.system(size: 13, weight: .heavy))
                    .padding(.horizontal, 14).padding(.vertical, 8)
                    .background(Theme.accent, in: Capsule())
                    .foregroundStyle(.white)
            }
        }
    }

    private var dot: some View { Text("·").opacity(0.6) }

    private var categoryEmoji: String {
        switch property.category {
        case .apartment: return "🏢"; case .villa: return "🏡"
        case .duplex: return "🏘️"; case .studio: return "🛏️"
        case .land: return "🌍"; case .office: return "🏢"
        case .shop: return "🏬"; case .farm: return "🌳"
        case .commercial: return "🏙️"; case .building: return "🏗️"
        }
    }
}

private struct IconAction: View {
    let system: String
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Image(systemName: system)
                .font(.system(size: 17, weight: .bold))
                .frame(width: 38, height: 38)
                .background(.ultraThinMaterial, in: Circle())
                .foregroundStyle(.white)
        }
        .buttonStyle(.plain)
    }
}
