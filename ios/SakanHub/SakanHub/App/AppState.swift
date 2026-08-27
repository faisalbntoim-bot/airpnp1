import SwiftUI
import Combine

@MainActor
final class AppState: ObservableObject {
    // Session
    @Published var currentUser: User?
    @Published var isAuthenticated: Bool = false

    // Router
    @Published var selectedTab: Tab = .home
    @Published var openedPropertyID: Property.ID?

    // Repositories (mock impls injected here so previews & UI compile without a backend)
    let propertyRepo: PropertyRepository
    let userRepo: UserRepository
    let bookingRepo: BookingRepository
    let favoriteRepo: FavoriteRepository
    let officeRepo: OfficeRepository
    let notificationRepo: NotificationRepository

    init(
        propertyRepo: PropertyRepository = MockPropertyRepository(),
        userRepo: UserRepository = MockUserRepository(),
        bookingRepo: BookingRepository = MockBookingRepository(),
        favoriteRepo: FavoriteRepository = MockFavoriteRepository(),
        officeRepo: OfficeRepository = MockOfficeRepository(),
        notificationRepo: NotificationRepository = MockNotificationRepository()
    ) {
        self.propertyRepo = propertyRepo
        self.userRepo = userRepo
        self.bookingRepo = bookingRepo
        self.favoriteRepo = favoriteRepo
        self.officeRepo = officeRepo
        self.notificationRepo = notificationRepo
    }

    enum Tab: Hashable {
        case home, search, map, saved, profile
    }
}
