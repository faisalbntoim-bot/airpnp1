import Foundation

struct PropertyMedia: Identifiable, Codable, Hashable {
    let id: String
    var kind: Kind
    var url: URL                    // remote or bundle:/// scheme
    var thumbnailURL: URL?
    var caption: String?
    var order: Int

    enum Kind: String, Codable {
        case image
        case video
        case pano360                // for the virtual-tour panoramas
        case model3D                // .usdz / .reality (rendered via Property3DRenderer)
        case gaussianSplat          // .ply / .splat / .ksplat (rendered via GaussianSplatRenderer)
    }
}
