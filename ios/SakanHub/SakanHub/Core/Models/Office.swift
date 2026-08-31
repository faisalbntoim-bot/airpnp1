import Foundation

struct Office: Identifiable, Codable, Hashable {
    let id: String
    var name: String
    var licenseNumber: String       // e.g. FAL 1200008845
    var ownerUserID: User.ID
    var agentIDs: [User.ID]
    var subscription: Subscription
    var propertiesCount: Int
    var rating: Double
    var isVerified: Bool

    enum Subscription: String, Codable, CaseIterable {
        case free      = "مجاني"
        case starter   = "الأساسية"
        case pro       = "الاحترافية"
        case enterprise = "المؤسسات"
    }
}
