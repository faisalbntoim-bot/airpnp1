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

    // Repositories — chosen at construction by `RepositoryFactory`, which honours
    // the `PRODUCTION` compile flag. Preview / test callers still pass Mocks by
    // hand via the explicit initialiser.
    let propertyRepo: PropertyRepository
    let userRepo: UserRepository
    let bookingRepo: BookingRepository
    let favoriteRepo: FavoriteRepository
    let officeRepo: OfficeRepository
    let notificationRepo: NotificationRepository
    let paymentService: PaymentService
    let authRepo: AuthRepository
    let walletRepo: WalletRepository
    let invoiceRepo: InvoiceRepository

    init(
        propertyRepo: PropertyRepository = RepositoryFactory.propertyRepository(),
        userRepo: UserRepository = RepositoryFactory.userRepository(),
        bookingRepo: BookingRepository = RepositoryFactory.bookingRepository(),
        favoriteRepo: FavoriteRepository = RepositoryFactory.favoriteRepository(),
        officeRepo: OfficeRepository = RepositoryFactory.officeRepository(),
        notificationRepo: NotificationRepository = RepositoryFactory.notificationRepository(),
        paymentService: PaymentService = RepositoryFactory.paymentService(),
        authRepo: AuthRepository = RepositoryFactory.auth(),
        walletRepo: WalletRepository = RepositoryFactory.wallet(),
        invoiceRepo: InvoiceRepository = RepositoryFactory.invoices()
    ) {
        self.propertyRepo = propertyRepo
        self.userRepo = userRepo
        self.bookingRepo = bookingRepo
        self.favoriteRepo = favoriteRepo
        self.officeRepo = officeRepo
        self.notificationRepo = notificationRepo
        self.paymentService = paymentService
        self.authRepo = authRepo
        self.walletRepo = walletRepo
        self.invoiceRepo = invoiceRepo
    }

    /// Convenience: swap to mocks explicitly (previews + tests).
    static func previewMocks() -> AppState {
        AppState(
            propertyRepo: MockPropertyRepository(),
            userRepo: MockUserRepository(),
            bookingRepo: MockBookingRepository(),
            favoriteRepo: MockFavoriteRepository(),
            officeRepo: MockOfficeRepository(),
            notificationRepo: MockNotificationRepository(),
            paymentService: MockPaymentService()
        )
    }

    enum Tab: Hashable {
        case home, search, map, saved, profile
    }
}
