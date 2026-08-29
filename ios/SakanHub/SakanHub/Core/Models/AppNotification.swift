import Foundation

/// Named `AppNotification` to avoid clashing with `Foundation.Notification`.
struct AppNotification: Identifiable, Codable, Hashable {
    let id: String
    var kind: Kind
    var title: String
    var body: String
    var propertyID: Property.ID?
    var isRead: Bool
    var createdAt: Date

    enum Kind: String, Codable {
        case saved              // "تم حفظ العقار"
        case bookingConfirmed   // "تم قبول الحجز"
        case bookingRejected    // "تم رفض الحجز"
        case viewingRequest     // "طلب معاينة"
        case priceChanged       // "تغير سعر العقار"
        case backAvailable      // "أصبح العقار متاحاً"
        case newMatch           // "عقار جديد مطابق للبحث"
        case message            // "رسالة جديدة"
        case system             // system
    }
}
