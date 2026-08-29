import SwiftUI
import MapKit

@MainActor
final class MapExploreViewModel: ObservableObject {
    @Published var region = MKCoordinateRegion(
        center: .init(latitude: 24.8360, longitude: 46.6320),
        span: .init(latitudeDelta: 0.12, longitudeDelta: 0.12)
    )
    @Published var properties: [Property] = []
    @Published var selected: Property?

    private let repo: PropertyRepository
    init(repo: PropertyRepository) { self.repo = repo }

    func loadNearby() async {
        do {
            properties = try await repo.nearby(centre: region.center, radiusMeters: 25_000)
        } catch { properties = [] }
    }
}

/// Uses MapKit only (no external SDKs). Extensible later to Mapbox etc.
struct MapExploreView: View {
    @StateObject private var vm: MapExploreViewModel = MapExploreViewModel(repo: RepositoryFactory.propertyRepository())

    /// Optional focus point + fixed height for embedding (e.g. inside a detail).
    var focus: CLLocationCoordinate2D? = nil
    var height: CGFloat? = nil
    var interactive: Bool = true

    var body: some View {
        ZStack(alignment: .bottom) {
            Map(coordinateRegion: $vm.region,
                interactionModes: interactive ? .all : [],
                showsUserLocation: interactive,
                annotationItems: vm.properties) { p in
                    MapAnnotation(coordinate: p.location.coordinate) {
                        PricePin(property: p, selected: vm.selected?.id == p.id) {
                            vm.selected = p
                        }
                    }
                }
                .onAppear {
                    if let f = focus {
                        vm.region.center = f
                        vm.region.span = .init(latitudeDelta: 0.01, longitudeDelta: 0.01)
                    }
                    Task { await vm.loadNearby() }
                    LocationService.shared.requestAuthorisation()
                }

            if let p = vm.selected, interactive {
                selectedCard(p)
            }
        }
        .frame(height: height)
    }

    private func selectedCard(_ p: Property) -> some View {
        HStack(spacing: 10) {
            RoundedRectangle(cornerRadius: 12).fill(Theme.accent.opacity(0.35))
                .frame(width: 62, height: 62)
                .overlay(Image(systemName: "photo").foregroundStyle(.white.opacity(0.7)))
            VStack(alignment: .trailing, spacing: 3) {
                Text(p.title).font(Theme.heading(13, weight: .heavy)).foregroundStyle(Theme.ink).lineLimit(2)
                Text("\(Int(p.priceSAR)) ر.س · \(p.location.neighborhood)")
                    .font(.system(size: 11)).foregroundStyle(Theme.textDim)
            }
            Spacer()
        }
        .padding(10)
        .background(Theme.paper, in: RoundedRectangle(cornerRadius: 14))
        .shadow(Theme.cardShadow)
        .padding(12)
    }
}

private struct PricePin: View {
    let property: Property
    let selected: Bool
    var tap: () -> Void
    var body: some View {
        Button(action: tap) {
            Text("\(Int(property.priceSAR / 1000))ك")
                .font(.system(size: 11, weight: .heavy))
                .padding(.horizontal, 9).padding(.vertical, 5)
                .background(selected ? Theme.accent : .white, in: Capsule())
                .foregroundStyle(selected ? .white : Theme.accentDeep)
                .shadow(color: .black.opacity(0.15), radius: 3, x: 0, y: 2)
                .overlay(Capsule().stroke(Theme.accent, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}
