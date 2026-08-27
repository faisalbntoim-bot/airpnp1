import Foundation

struct SearchFilter: Codable, Hashable {
    var query: String = ""
    var city: String?
    var neighborhood: String?
    var categories: Set<Property.Category> = []
    var purposes: Set<Property.Purpose> = []
    var minPriceSAR: Double?
    var maxPriceSAR: Double?
    var minArea: Double?
    var maxArea: Double?
    var rooms: Int?
    var bathrooms: Int?
    var minYearBuilt: Int?
    var furnishedOnly: Bool = false
    var mustHave: Set<String> = []          // free-form feature keys: "pool", "elevator"...
    var sort: Sort = .relevance

    enum Sort: String, Codable, CaseIterable {
        case relevance = "الأنسب"
        case newest    = "الأحدث"
        case priceAsc  = "السعر الأقل"
        case priceDesc = "السعر الأعلى"
        case areaDesc  = "الأكبر مساحة"
    }
}
