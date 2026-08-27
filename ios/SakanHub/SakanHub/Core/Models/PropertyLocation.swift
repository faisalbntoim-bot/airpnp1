import Foundation
import CoreLocation

struct PropertyLocation: Codable, Hashable {
    var latitude: Double
    var longitude: Double
    var city: String
    var neighborhood: String
    var streetName: String?
    var district: String?
    var country: String

    /// Optional polygon defining the land parcel boundary (used by AR overlay).
    /// Ordered clockwise or CCW; at least 3 points to render.
    var boundaryPolygon: [Coordinate]?

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    struct Coordinate: Codable, Hashable {
        var lat: Double
        var lng: Double
        var clLocation: CLLocationCoordinate2D { .init(latitude: lat, longitude: lng) }
    }
}
