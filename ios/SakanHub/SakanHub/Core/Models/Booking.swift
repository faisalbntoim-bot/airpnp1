import Foundation

struct Booking: Identifiable, Codable, Hashable {
    let id: String
    var propertyID: Property.ID
    var guestID: User.ID
    var checkIn: Date
    var checkOut: Date
    var nights: Int
    var pricePerNightSAR: Double
    var cleaningFeeSAR: Double
    var serviceFeeSAR: Double
    var vatSAR: Double
    var totalSAR: Double
    var status: Status
    var createdAt: Date

    enum Status: String, Codable {
        case pending, confirmed, rejected, cancelled, completed
    }
}
