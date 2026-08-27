import Foundation
import CoreLocation

struct Property: Identifiable, Codable, Hashable {
    let id: UUID
    var listingNumber: String       // human-friendly ID (e.g. LAND-1042)
    var title: String
    var summary: String

    var category: Category
    var purpose: Purpose             // sale · rent · daily
    var status: Status

    // Pricing
    var priceSAR: Double              // for sale/rent (annual)
    var dailyRateSAR: Double?         // for daily rent
    var monthlyRateSAR: Double?       // for monthly rent
    var pricePerMeterSAR: Double?

    // Physical
    var areaSquareMeters: Double
    var rooms: Int?
    var bathrooms: Int?
    var yearBuilt: Int?
    var furnished: Bool?
    var floors: Int?

    var location: PropertyLocation
    var features: PropertyFeatures
    var media: [PropertyMedia]
    var model3D: Property3DModel?
    var tour: VirtualTour?

    // Meta
    var ownerID: User.ID
    var officeID: Office.ID?
    var agentIDs: [User.ID]
    var createdAt: Date
    var updatedAt: Date
    var viewsCount: Int
    var featured: Bool
    var boostedUntil: Date?

    enum Category: String, Codable, CaseIterable {
        case apartment = "شقة"
        case villa     = "فيلا"
        case duplex    = "دوبلكس"
        case studio    = "استوديو"
        case land      = "أرض"
        case office    = "مكتب"
        case shop      = "محل"
        case farm      = "مزرعة"
        case commercial = "تجاري"
        case building  = "عمارة"
    }

    enum Purpose: String, Codable, CaseIterable {
        case sale    = "للبيع"
        case rent    = "للإيجار"          // annual
        case daily   = "إيجار يومي"
        case monthly = "إيجار شهري"
    }

    enum Status: String, Codable {
        case available = "متاح"
        case reserved  = "محجوز"
        case sold      = "مباع"
        case rented    = "مؤجّر"
        case hidden    = "مخفي"
    }
}
