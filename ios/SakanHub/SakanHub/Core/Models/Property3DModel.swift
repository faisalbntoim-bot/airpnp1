import Foundation

/// Represents a 3D model attached to a property.
/// The concrete rendering is done by any conforming `Property3DRenderer`.
struct Property3DModel: Codable, Hashable {
    var format: Format
    var url: URL
    /// Real-world footprint (metres) — used to place the model on a plane / on the parcel.
    var footprintMeters: Footprint
    var elevationOffset: Double = 0
    var rotationDegrees: Double = 0
    var thumbnailURL: URL?

    enum Format: String, Codable {
        case usdz
        case reality
        case gltf
        case glb
        case gaussianSplatPly       // 3DGS: raw PLY
        case gaussianSplatKS        // 3DGS: KSplat / compressed variants
    }

    struct Footprint: Codable, Hashable {
        var width: Double
        var length: Double
        var height: Double
    }
}
