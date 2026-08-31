import Foundation
import RealityKit

/// 3D Gaussian Splatting renderer — architecture-first stub.
///
/// **State of the world (honest):** RealityKit / SceneKit have no first-party support
/// for the raw 3DGS format. Rendering it on-device typically requires ONE of:
/// - a Metal-based renderer (see `metal-splatting`, `SplatCloud`, etc. — none official)
/// - a WebGPU/WebGL viewer embedded in a WKWebView (many OSS viewers exist)
/// - a server-side render → converted to USDZ or a video, then displayed here
///
/// This stub reserves the plug point. When you wire a real backend/renderer:
///   1. Add the framework to `SakanHub.xcodeproj`.
///   2. Replace `load(for:)` to return an `Entity` (or drive a custom `UIView` you
///      then wrap in a `UIViewRepresentable` — see `Property3DView`).
///   3. Update `Property.model3D.format` to `.gaussianSplatPly` or `.gaussianSplatKS`.
///
/// Never claim GS "just works" until this stub is replaced.
struct GaussianSplatRenderer: Property3DRenderer {

    /// Configuration read from `Config.gaussianSplatRendererURL` (e.g. cloud service URL).
    var serviceURL: URL? {
        let s = Config.gaussianSplatRendererURL
        return s.isEmpty ? nil : URL(string: s)
    }

    func load(for property: Property) async throws -> ModelEntity {
        // Prefer the on-device path when we actually have one wired.
        // For now we surface a clear, actionable error instead of a fake success.
        throw APIError.notImplemented
    }
}
