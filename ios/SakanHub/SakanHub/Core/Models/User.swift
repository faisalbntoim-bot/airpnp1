import Foundation

struct User: Identifiable, Codable, Hashable {
    let id: String
    var name: String
    var phone: String
    var email: String?
    var role: Role
    var officeID: Office.ID?
    var avatarURL: URL?
    var isVerified: Bool
    var createdAt: Date

    enum Role: String, Codable, CaseIterable {
        case owner     = "مالك"
        case seeker    = "باحث"
        case marketer  = "مسوق"
        case office    = "مكتب"
    }
}
