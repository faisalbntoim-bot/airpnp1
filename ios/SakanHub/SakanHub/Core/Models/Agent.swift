import Foundation

/// A marketer/agent who is authorised to list & promote specific properties.
struct Agent: Identifiable, Codable, Hashable {
    let id: String
    var userID: User.ID
    var officeID: Office.ID?
    var authorisedPropertyIDs: Set<Property.ID>
    var leadsCount: Int
    var viewsCount: Int
    var commissionPercent: Double
}
