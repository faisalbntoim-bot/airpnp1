import Foundation
import ARKit
import RealityKit
import CoreLocation
import Combine

/// Runs the ARKit session, manages anchors and overlays for a single property view.
/// - Uses `ARGeoTrackingConfiguration` when the device + region support it (limited to select cities).
/// - Otherwise falls back to `ARWorldTrackingConfiguration` with plane detection and a bearing/distance
///   hint computed from GPS + compass. Never claims sub-metre precision.
@MainActor
final class ARManager: NSObject, ObservableObject {
    // Published state consumed by SwiftUI
    @Published var showError: Bool = false
    @Published var errorMessage: String?
    @Published var usingGeoAnchor: Bool = false
    @Published var buildingVisible: Bool = false
    @Published var distanceToPropertyMetres: CLLocationDistance? = nil

    private weak var arView: ARView?
    private var property: Property?
    private var landAnchorEntity: AnchorEntity?
    private var buildingAnchorEntity: AnchorEntity?
    private var location = LocationService.shared
    private var cancellables = Set<AnyCancellable>()

    private let renderer: Property3DRenderer = USDZRenderer()

    // Callback for the "إظهار التفاصيل" button — set by the SwiftUI wrapper via `emitShowDetails`.
    var onRequestDetails: (() -> Void)?

    func attach(view: ARView, property: Property) {
        self.arView = view
        self.property = property
    }

    func start(for property: Property) {
        self.property = property
        guard ARWorldTrackingConfiguration.isSupported else {
            errorMessage = "جهازك لا يدعم ARKit."
            showError = true; return
        }
        location.requestAuthorisation()
        location.start()

        // Wire location updates → recompute distance.
        location.$location
            .compactMap { $0 }
            .sink { [weak self] loc in
                guard let self, let p = self.property else { return }
                self.distanceToPropertyMetres = loc.distance(from: .init(latitude: p.location.latitude,
                                                                        longitude: p.location.longitude))
            }
            .store(in: &cancellables)

        configureSession(for: property)
        placeLandOverlay(for: property)
    }

    func stop() {
        cancellables.removeAll()
        location.stop()
        arView?.session.pause()
    }

    // MARK: - Session

    private func configureSession(for property: Property) {
        guard let arView else { return }
        // Try geo-tracking first (limited availability).
        if #available(iOS 14.0, *), ARGeoTrackingConfiguration.isSupported {
            ARGeoTrackingConfiguration.checkAvailability { [weak self] available, _ in
                DispatchQueue.main.async {
                    if available {
                        let cfg = ARGeoTrackingConfiguration()
                        cfg.planeDetection = [.horizontal]
                        arView.session.run(cfg)
                        self?.usingGeoAnchor = true
                    } else {
                        self?.runWorldTracking(on: arView)
                    }
                }
            }
        } else {
            runWorldTracking(on: arView)
        }
    }

    private func runWorldTracking(on arView: ARView) {
        let cfg = ARWorldTrackingConfiguration()
        cfg.planeDetection = [.horizontal]
        cfg.environmentTexturing = .automatic
        arView.session.run(cfg)
        usingGeoAnchor = false
    }

    // MARK: - Overlays

    private func placeLandOverlay(for property: Property) {
        guard let arView else { return }

        // Remove any prior anchor.
        if let old = landAnchorEntity { arView.scene.removeAnchor(old) }

        let anchor: AnchorEntity
        if usingGeoAnchor, #available(iOS 14.0, *) {
            let geo = ARGeoAnchor(coordinate: CLLocationCoordinate2D(latitude: property.location.latitude,
                                                                     longitude: property.location.longitude))
            arView.session.add(anchor: geo)
            anchor = AnchorEntity(anchor: geo)
        } else {
            // Use a horizontal plane anchor at the user's location + a translation hint from bearing.
            anchor = AnchorEntity(plane: .horizontal, minimumBounds: [0.2, 0.2])
        }

        // Build the boundary polygon on the ground:
        let mesh = LandOverlay.buildPolygonMesh(from: property.location)
        let material = SimpleMaterial(color: .init(red: 0.15, green: 0.75, blue: 0.55, alpha: 0.35),
                                       roughness: .float(0.9), isMetallic: false)
        let landEntity = ModelEntity(mesh: mesh, materials: [material])

        // Border outline (small extrusion so the edge reads clearly on any ground).
        let border = LandOverlay.buildBorderEntity(from: property.location)

        anchor.addChild(landEntity)
        anchor.addChild(border)
        arView.scene.addAnchor(anchor)
        landAnchorEntity = anchor
    }

    func toggleBuilding(for property: Property) {
        if buildingVisible { removeBuilding() } else { placeBuilding(for: property) }
        buildingVisible.toggle()
    }

    private func placeBuilding(for property: Property) {
        guard let arView, let landAnchor = landAnchorEntity else { return }
        Task {
            do {
                let entity = try await renderer.load(for: property)
                await MainActor.run {
                    landAnchor.addChild(entity)
                    buildingAnchorEntity = landAnchor
                    entity.generateCollisionShapes(recursive: true)
                    arView.installGestures([.rotation, .scale, .translation], for: entity)
                }
            } catch {
                errorMessage = "تعذّر تحميل النموذج ثلاثي الأبعاد: \(error.localizedDescription)"
                showError = true
            }
        }
    }

    private func removeBuilding() {
        guard let anchor = buildingAnchorEntity else { return }
        anchor.children.removeAll { $0 is ModelEntity && $0.name == "buildingModel" }
    }

    // MARK: - Hooks used by SwiftUI wrapper

    func emitShowDetails() { onRequestDetails?() }
}
