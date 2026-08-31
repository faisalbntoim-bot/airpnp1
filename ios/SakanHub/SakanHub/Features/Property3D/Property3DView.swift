import SwiftUI
import RealityKit
import ARKit

/// Standalone 3D preview (rotate/pinch/zoom) that lives on the property detail sheet.
/// Uses RealityKit for USDZ; delegates GS to `GaussianSplatRenderer` when configured.
struct Property3DView: View {
    let property: Property
    @Environment(\.dismiss) private var dismiss
    @State private var errorText: String?

    var body: some View {
        NavigationStack {
            ZStack {
                if let msg = errorText {
                    EmptyStateView(icon: "cube.transparent",
                                   title: "لا يوجد نموذج ثلاثي الأبعاد",
                                   subtitle: msg)
                } else {
                    ThreeDPreview(property: property, onError: { errorText = $0 })
                        .ignoresSafeArea(edges: .bottom)
                }
            }
            .background(Theme.bg)
            .navigationTitle("عرض ثلاثي الأبعاد")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("إغلاق") { dismiss() }
                }
            }
        }
    }
}

private struct ThreeDPreview: UIViewRepresentable {
    let property: Property
    var onError: (String) -> Void

    func makeUIView(context: Context) -> ARView {
        let arView = ARView(frame: .zero, cameraMode: .nonAR, automaticallyConfigureSession: false)
        arView.environment.background = .color(.init(white: 0.96, alpha: 1))
        Task { await load(into: arView) }
        return arView
    }
    func updateUIView(_ uiView: ARView, context: Context) {}

    @MainActor
    private func load(into view: ARView) async {
        let renderer: Property3DRenderer
        switch property.model3D?.format {
        case .gaussianSplatPly, .gaussianSplatKS: renderer = GaussianSplatRenderer()
        case .gltf, .glb:                          renderer = GLTFRenderer()
        default:                                   renderer = USDZRenderer()
        }
        do {
            let entity = try await renderer.load(for: property)
            let anchor = AnchorEntity(world: [0, 0, -1.2])
            anchor.addChild(entity)
            view.scene.addAnchor(anchor)
            entity.generateCollisionShapes(recursive: true)
            view.installGestures([.rotation, .scale, .translation], for: entity)
        } catch APIError.notImplemented {
            onError("هذا العقار مرتبط بنموذج بصيغة تحتاج محرّك عرض غير مضاف بعد.")
        } catch {
            onError(error.localizedDescription)
        }
    }
}
