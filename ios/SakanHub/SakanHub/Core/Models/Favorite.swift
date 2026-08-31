import Foundation

struct Favorite: Identifiable, Codable, Hashable {
    let id: String
    var userID: User.ID
    var propertyID: Property.ID
    var savedAt: Date
    var note: String?
}
