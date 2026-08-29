import Foundation

// MARK: - User

protocol UserRepository {
    func currentUser() async -> User?
    func signIn(phone: String, otp: String) async throws -> User
    func signOut() async
    func updateProfile(_ user: User) async throws -> User
}

actor MockUserRepository: UserRepository {
    private var user: User? = MockData.demoUser
    func currentUser() async -> User? { user }
    func signIn(phone: String, otp: String) async throws -> User {
        try await Task.sleep(nanoseconds: 400_000_000)
        user = MockData.demoUser
        return user!
    }
    func signOut() async { user = nil }
    func updateProfile(_ u: User) async throws -> User {
        user = u; return u
    }
}

// MARK: - Booking

protocol BookingRepository {
    func list(forGuest guestID: User.ID) async throws -> [Booking]
    func availability(for propertyID: Property.ID) async throws -> Set<Date>
    func create(_ booking: Booking) async throws -> Booking
    func cancel(id: Booking.ID) async throws
}

actor MockBookingRepository: BookingRepository {
    private var bookings: [Booking] = []
    private let calendar = Calendar(identifier: .gregorian)

    func list(forGuest guestID: User.ID) async throws -> [Booking] {
        bookings.filter { $0.guestID == guestID }
    }
    func availability(for propertyID: Property.ID) async throws -> Set<Date> {
        // Return a deterministic-ish set of "booked" days for the mock UI.
        var s = Set<Date>()
        let today = Date()
        for offset in [3, 4, 5, 11, 12, 20, 21] {
            if let d = calendar.date(byAdding: .day, value: offset, to: today) { s.insert(d) }
        }
        return s
    }
    func create(_ booking: Booking) async throws -> Booking {
        bookings.append(booking); return booking
    }
    func cancel(id: Booking.ID) async throws {
        bookings.removeAll { $0.id == id }
    }
}

// MARK: - Favorite

protocol FavoriteRepository {
    func list(for userID: User.ID) async -> [Favorite]
    func isSaved(propertyID: Property.ID, userID: User.ID) async -> Bool
    func toggle(propertyID: Property.ID, userID: User.ID) async -> Bool
}

actor MockFavoriteRepository: FavoriteRepository {
    private var favs: [Favorite] = []

    func list(for userID: User.ID) async -> [Favorite] {
        favs.filter { $0.userID == userID }
    }
    func isSaved(propertyID: Property.ID, userID: User.ID) async -> Bool {
        favs.contains { $0.propertyID == propertyID && $0.userID == userID }
    }
    func toggle(propertyID: Property.ID, userID: User.ID) async -> Bool {
        if let i = favs.firstIndex(where: { $0.propertyID == propertyID && $0.userID == userID }) {
            favs.remove(at: i)
            return false
        }
        favs.append(.init(id: UUID().uuidString, userID: userID, propertyID: propertyID, savedAt: .now, note: nil))
        return true
    }
}

// MARK: - Office

protocol OfficeRepository {
    func get(id: Office.ID) async throws -> Office?
    func list() async throws -> [Office]
    func stats(for id: Office.ID) async throws -> OfficeStats
}

struct OfficeStats {
    var activeListings: Int
    var monthlyViews: Int
    var monthlyLeads: Int
    var completedDeals: Int
    var monthlyRevenueSAR: Double
}

actor MockOfficeRepository: OfficeRepository {
    func get(id: Office.ID) async throws -> Office? {
        MockData.offices.first { $0.id == id }
    }
    func list() async throws -> [Office] { MockData.offices }
    func stats(for id: Office.ID) async throws -> OfficeStats {
        .init(activeListings: 12, monthlyViews: 12_840, monthlyLeads: 186, completedDeals: 7, monthlyRevenueSAR: 88_000)
    }
}

// MARK: - Notifications

protocol NotificationRepository {
    func list(for userID: User.ID) async throws -> [AppNotification]
    func markRead(id: AppNotification.ID) async throws
}

actor MockNotificationRepository: NotificationRepository {
    private var notes: [AppNotification] = MockData.notifications
    func list(for userID: User.ID) async throws -> [AppNotification] { notes }
    func markRead(id: AppNotification.ID) async throws {
        if let i = notes.firstIndex(where: { $0.id == id }) { notes[i].isRead = true }
    }
}
