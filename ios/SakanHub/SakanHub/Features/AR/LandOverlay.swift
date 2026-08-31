import Foundation
import RealityKit
import CoreLocation
import simd

/// Builds the polygon overlay + border for a property's parcel.
enum LandOverlay {

    /// Convert the parcel's boundary (or a synthetic square around lat/lng)
    /// to a triangulated `MeshResource` centred on the parcel's centroid.
    static func buildPolygonMesh(from loc: PropertyLocation) -> MeshResource {
        let coords = polygonCoordinates(from: loc)
        let centre = centroid(of: coords)
        let localXY = coords.map { flat(offsetMetres: $0, from: centre) }
        return MeshResource.generatePlane(width: bounds(localXY).width,
                                          depth: bounds(localXY).depth)
    }

    /// A thin extruded outline (10 cm high) that reads clearly on the ground.
    static func buildBorderEntity(from loc: PropertyLocation) -> ModelEntity {
        let coords = polygonCoordinates(from: loc)
        let centre = centroid(of: coords)
        let localXY = coords.map { flat(offsetMetres: $0, from: centre) }
        let (w, d) = (bounds(localXY).width, bounds(localXY).depth)
        let border = ModelEntity(
            mesh: .generateBox(size: [w, 0.05, d], cornerRadius: 0.02),
            materials: [SimpleMaterial(color: .init(red: 0.24, green: 0.9, blue: 0.7, alpha: 0.7),
                                       roughness: .float(0.7), isMetallic: false)]
        )
        border.position = [0, 0.03, 0]
        return border
    }

    // MARK: - Helpers

    private static let earthRadius: Double = 6_378_137

    /// If polygon coords were provided use them; otherwise build a square whose side ≈ √area.
    private static func polygonCoordinates(from loc: PropertyLocation) -> [CLLocationCoordinate2D] {
        if let poly = loc.boundaryPolygon, poly.count >= 3 {
            return poly.map { CLLocationCoordinate2D(latitude: $0.lat, longitude: $0.lng) }
        }
        // Default: a 20m×20m square centred on the property.
        let d: Double = 20
        let dLat = (d / earthRadius) * (180 / .pi)
        let dLng = (d / earthRadius) * (180 / .pi) / cos(loc.latitude * .pi / 180)
        return [
            .init(latitude: loc.latitude + dLat/2, longitude: loc.longitude - dLng/2),
            .init(latitude: loc.latitude + dLat/2, longitude: loc.longitude + dLng/2),
            .init(latitude: loc.latitude - dLat/2, longitude: loc.longitude + dLng/2),
            .init(latitude: loc.latitude - dLat/2, longitude: loc.longitude - dLng/2)
        ]
    }

    private static func centroid(of coords: [CLLocationCoordinate2D]) -> CLLocationCoordinate2D {
        guard !coords.isEmpty else { return .init(latitude: 0, longitude: 0) }
        let lat = coords.map(\.latitude).reduce(0, +) / Double(coords.count)
        let lng = coords.map(\.longitude).reduce(0, +) / Double(coords.count)
        return .init(latitude: lat, longitude: lng)
    }

    /// Metre-level offset (east, north) from a centre point.
    private static func flat(offsetMetres coord: CLLocationCoordinate2D,
                             from centre: CLLocationCoordinate2D) -> SIMD3<Float> {
        let dLat = (coord.latitude - centre.latitude) * .pi / 180
        let dLng = (coord.longitude - centre.longitude) * .pi / 180
        let north = Float(dLat * earthRadius)
        let east  = Float(dLng * earthRadius * cos(centre.latitude * .pi / 180))
        // ARKit: +X east, +Y up, -Z north (looking north).
        return SIMD3<Float>(east, 0, -north)
    }

    private static func bounds(_ pts: [SIMD3<Float>]) -> (width: Float, depth: Float) {
        guard !pts.isEmpty else { return (2, 2) }
        let xs = pts.map(\.x), zs = pts.map(\.z)
        return ((xs.max()! - xs.min()!), (zs.max()! - zs.min()!))
    }
}
