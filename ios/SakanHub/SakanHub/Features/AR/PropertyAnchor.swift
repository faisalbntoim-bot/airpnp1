import Foundation
import ARKit
import CoreLocation

/// Value type describing where a property should be anchored in the AR scene.
/// The concrete `ARAnchor` (geo or plane) is created by `ARManager`.
struct PropertyAnchor: Equatable {
    let propertyID: Property.ID
    let coordinate: CLLocationCoordinate2D
    var altitudeOffset: Double = 0
    var facingDegrees: Double = 0

    var clLocation: CLLocation {
        CLLocation(coordinate: coordinate, altitude: altitudeOffset,
                   horizontalAccuracy: 5, verticalAccuracy: 5, timestamp: .now)
    }
}
