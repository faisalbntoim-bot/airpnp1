import Foundation
import RealityKit

/// Abstraction so we can swap 3D engines/formats later without touching feature code.
protocol Property3DRenderer {
    /// Load an entity for the given property. Should return an entity ready to add to a scene.
    /// Implementations must be safe to call from any actor context; they can perform network I/O.
    func load(for property: Property) async throws -> ModelEntity
}

/// USDZ / Reality file loader — native to RealityKit.
struct USDZRenderer: Property3DRenderer {
    func load(for property: Property) async throws -> ModelEntity {
        guard let model = property.model3D, [.usdz, .reality].contains(model.format) else {
            // Fallback: a house-shaped placeholder so the UX never breaks.
            return placeholder(for: property)
        }
        do {
            let entity = try await ModelEntity(contentsOf: model.url)
            entity.name = "buildingModel"
            return entity
        } catch {
            return placeholder(for: property)
        }
    }

    private func placeholder(for property: Property) -> ModelEntity {
        // A translucent box the size of the parcel × ~1 floor.
        let side = Float(sqrt(max(property.areaSquareMeters, 30)))
        let h: Float = 3
        let box = ModelEntity(
            mesh: .generateBox(size: [side * 0.5, h, side * 0.5], cornerRadius: 0.15),
            materials: [SimpleMaterial(color: .init(red: 0.18, green: 0.82, blue: 0.6, alpha: 0.55),
                                       roughness: .float(0.6), isMetallic: false)]
        )
        box.name = "buildingModel"
        box.position = [0, h/2, 0]
        return box
    }
}

/// GLB / GLTF (needs a conversion step to USDZ, or a third-party runtime like `GLTFKit2`).
/// This stub is intentionally explicit: it throws until a real pipeline is wired.
struct GLTFRenderer: Property3DRenderer {
    func load(for property: Property) async throws -> ModelEntity {
        throw APIError.notImplemented   // TODO: add GLTFKit2 or a server-side GLB→USDZ conversion.
    }
}
