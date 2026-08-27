import SwiftUI
import ARKit
import RealityKit
import CoreLocation

/// Full-screen AR view that:
/// 1. Runs an ARKit `worldTracking` session with plane detection.
/// 2. Uses GPS + compass to place a `PropertyAnchor` for the property (or its parcel).
/// 3. Draws a translucent `LandOverlay` polygon and a floating info card.
/// 4. Optionally loads a `Property3DModel` (USDZ/Reality/GLB stub) on the parcel.
///
/// Honesty notes:
/// - GPS alone is metre-scale accurate at best. This scaffold **does not claim** cm precision.
/// - `Geospatial` anchors from ARGeoTrackingConfiguration are used **only when available**.
/// - 3DGS rendering is not native to RealityKit; see `GaussianSplatRenderer` — it currently returns a stub.
struct ARPropertyView: View {
    let property: Property
    @Environment(\.dismiss) private var dismiss
    @StateObject private var manager = ARManager()

    var body: some View {
        ZStack(alignment: .top) {
            ARContainer(manager: manager, property: property)
                .ignoresSafeArea()

            hud
                .padding(.horizontal, 14).padding(.top, 40)
        }
        .onAppear { manager.start(for: property) }
        .onDisappear { manager.stop() }
        .alert("تعذّر تشغيل الواقع المعزّز", isPresented: $manager.showError, actions: {
            Button("إغلاق") { dismiss() }
        }, message: {
            Text(manager.errorMessage ?? "جهازك أو الأذونات لا تدعم AR حاليًا.")
        })
    }

    private var hud: some View {
        VStack(spacing: 8) {
            HStack {
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .frame(width: 36, height: 36)
                        .background(.ultraThinMaterial, in: Circle())
                        .foregroundStyle(.white)
                }
                Spacer()
                if manager.usingGeoAnchor {
                    Label("Geo Tracking", systemImage: "location.viewfinder")
                        .labelStyle(.iconOnly)
                        .padding(8).background(.ultraThinMaterial, in: Capsule())
                }
            }
            InfoCard(property: property, distanceMetres: manager.distanceToPropertyMetres)
            HStack(spacing: 8) {
                Button("إظهار التفاصيل") { manager.emitShowDetails() }
                    .buttonStyle(.borderedProminent).tint(Theme.accent)
                Button {
                    manager.toggleBuilding(for: property)
                } label: {
                    Label(manager.buildingVisible ? "إخفاء المبنى" : "شاهد المبنى هنا", systemImage: "cube.transparent")
                }
                .buttonStyle(.bordered).tint(.white)
            }
        }
    }
}

private struct InfoCard: View {
    let property: Property
    var distanceMetres: CLLocationDistance?
    var body: some View {
        HStack(spacing: 10) {
            RoundedRectangle(cornerRadius: 10).fill(Theme.accent.opacity(0.35))
                .frame(width: 50, height: 50)
                .overlay(Image(systemName: "photo").foregroundStyle(.white))
            VStack(alignment: .trailing, spacing: 3) {
                Text(property.title).font(Theme.heading(13, weight: .heavy)).foregroundStyle(Theme.ink).lineLimit(1)
                HStack(spacing: 6) {
                    Text("\(Int(property.areaSquareMeters)) م²")
                    Text("·").opacity(0.5)
                    Text("\(Int(property.priceSAR)) ر.س")
                    if let d = distanceMetres {
                        Text("·").opacity(0.5)
                        Text(d < 1000 ? "\(Int(d)) م" : String(format: "%.1f كم", d / 1000))
                    }
                }
                .font(.system(size: 11)).foregroundStyle(Theme.textDim)
                Text(property.listingNumber).font(.system(size: 10)).foregroundStyle(Theme.textDim)
            }
        }
        .padding(10)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
    }
}

// MARK: - UIViewRepresentable ARView container

private struct ARContainer: UIViewRepresentable {
    let manager: ARManager
    let property: Property

    func makeUIView(context: Context) -> ARView {
        let arView = ARView(frame: .zero)
        manager.attach(view: arView, property: property)
        return arView
    }
    func updateUIView(_ uiView: ARView, context: Context) {}
}
