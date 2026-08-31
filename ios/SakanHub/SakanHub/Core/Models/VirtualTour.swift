import Foundation

struct VirtualTour: Codable, Hashable {
    var rooms: [Room]
    var startRoomID: UUID?

    struct Room: Identifiable, Codable, Hashable {
        let id: String
        var name: String                // "الصالة", "المطبخ"...
        var panoramaURL: URL            // 360 equirectangular image
        var hotspots: [TourHotspot]
    }

    struct TourHotspot: Identifiable, Codable, Hashable {
        let id: String
        var label: String
        /// Direction the hotspot lives at (spherical), in degrees.
        var yawDegrees: Double
        var pitchDegrees: Double
        var action: Action

        enum Action: Codable, Hashable {
            case navigate(roomID: String)
            case info(title: String, body: String)
            case openAR
        }
    }
}
