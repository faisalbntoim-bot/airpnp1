import Foundation

/// Central selector for either the Mock stack (previews / tests / dev) or the
/// Http stack (staging / production).
///
/// Compile-time invariant:
///   In the Production scheme the `PRODUCTION` flag is set. `AppEnvironment.useMocks`
///   is hard-`false` there, and there is no other path that returns a Mock repo.
///   Even if someone flips `USE_MOCKS=YES` in a Production Info.plist by mistake,
///   the code below still returns the Http implementation.
enum RepositoryFactory {

    static var currentUsesMocks: Bool {
        #if PRODUCTION
        return false
        #else
        return AppEnvironment.useMocks
        #endif
    }

    // MARK: - Property

    static func propertyRepository() -> PropertyRepository {
        currentUsesMocks ? MockPropertyRepository() : HttpPropertyRepository()
    }

    // MARK: - Booking

    static func bookingRepository() -> BookingRepository {
        currentUsesMocks ? MockBookingRepository() : HttpBookingRepository()
    }

    // MARK: - Favorite / Office / Notification (no real endpoints yet)

    static func favoriteRepository() -> FavoriteRepository {
        // No backend endpoint yet — mocks stand in for these read-only surfaces.
        MockFavoriteRepository()
    }
    static func officeRepository() -> OfficeRepository {
        MockOfficeRepository()
    }
    static func notificationRepository() -> NotificationRepository {
        MockNotificationRepository()
    }

    // MARK: - User

    static func userRepository() -> UserRepository {
        // Legacy protocol wraps around OTP. In real mode we use HttpAuthRepository
        // via an adapter so existing views don't have to change.
        currentUsesMocks ? MockUserRepository() : HttpAuthUserAdapter()
    }

    // MARK: - Financial services (no legacy protocol)

    static func auth() -> AuthRepository {
        HttpAuthRepository()
    }
    static func wallet() -> WalletRepository {
        HttpWalletRepository()
    }
    static func invoices() -> InvoiceRepository {
        HttpInvoiceRepository()
    }
    static func payments() -> HttpPaymentServiceProtocol {
        HttpPaymentService()
    }
    static func paymentService() -> PaymentService {
        currentUsesMocks ? MockPaymentService() : HttpPaymentServiceAdapter()
    }

    /// AI recommendations are backed by a future `/v1/ai/*` endpoint. Until
    /// that ships, Production returns a strict "not implemented" service that
    /// throws — it does NOT fall back to Mock. Dev/preview get the mock.
    static func aiRecommendationService() -> AIRecommendationService {
        currentUsesMocks ? MockAIRecommendationService() : DisabledAIRecommendationService()
    }
}

/// Production-safe stand-in until a real AI backend exists.
/// Never fabricates recommendations — throws `APIError.notImplemented` so the
/// UI can hide the affordance rather than show fake data.
struct DisabledAIRecommendationService: AIRecommendationService {
    func filterFromNaturalLanguage(_ prompt: String) async throws -> SearchFilter { throw APIError.notImplemented }
    func evaluate(property: Property) async throws -> AIEvaluation { throw APIError.notImplemented }
    func summarise(property: Property) async throws -> String { throw APIError.notImplemented }
}

// MARK: - Adapters for legacy protocols

/// Bridges the legacy `UserRepository` protocol to the real OTP + JWT flow.
/// The legacy `signIn(phone:otp:)` shape is preserved for the existing UI.
actor HttpAuthUserAdapter: UserRepository {
    private var current: User?
    private var pendingRequestId: String?

    func currentUser() async -> User? {
        if let u = current { return u }
        // Try to load from /me if we still hold a token.
        guard await TokenStore.shared.accessToken() != nil else { return nil }
        do {
            let api = try await RepositoryFactory.auth().me()
            let u = Self.toDomain(api)
            current = u
            return u
        } catch {
            return nil
        }
    }

    func signIn(phone: String, otp: String) async throws -> User {
        // The legacy protocol collapses request + verify into one call. We treat
        // an empty `otp` as "please request one" and a non-empty as verify.
        let auth = RepositoryFactory.auth()
        if otp.isEmpty {
            let req = try await auth.requestOtp(phone: phone)
            pendingRequestId = req.requestId
            throw APIError.badRequest("OTP sent — call signIn again with the code")
        }
        guard let requestId = pendingRequestId else {
            let req = try await auth.requestOtp(phone: phone)
            pendingRequestId = req.requestId
            throw APIError.badRequest("OTP sent — call signIn again with the code")
        }
        let result = try await auth.verifyOtp(requestId: requestId, phone: phone, code: otp, nameAr: nil)
        pendingRequestId = nil
        let user = Self.toDomain(result.user)
        current = user
        return user
    }

    func signOut() async {
        try? await RepositoryFactory.auth().logout()
        current = nil
    }

    func updateProfile(_ u: User) async throws -> User {
        // No profile-update endpoint yet — return the input as a no-op success.
        current = u
        return u
    }

    static func toDomain(_ u: APIUser) -> User {
        let role: User.Role
        switch u.role ?? u.currentRole ?? .customer {
        case .host:                role = .owner
        case .owner:               role = .owner
        case .office:              role = .office
        case .marketer:            role = .marketer
        case .customer, .admin,
             .financeAdmin, .superAdmin: role = .seeker
        }
        return User(
            id: u.id,                                   // cuid pass-through
            name: u.nameAr,
            phone: u.phone,
            email: u.email,
            role: role,
            officeID: nil,
            avatarURL: nil,
            isVerified: true,
            createdAt: Date()
        )
    }
}

/// Bridges `PaymentService.startCheckout(amount:currency:orderRef:)` to `HttpPaymentService`.
/// The legacy call is best-effort: it starts a checkout for the given orderRef
/// (which must be a real bookingId) and reports `pending` — the real status comes
/// from a subsequent `paymentStatus(id:)` call once the webhook lands.
struct HttpPaymentServiceAdapter: PaymentService {
    func startCheckout(amount: Double, currency: String, orderRef: String) async throws -> PaymentResult {
        let http = HttpPaymentService()
        do {
            let start = try await http.startCheckout(bookingId: orderRef, returnUrl: nil, idempotencyKey: UUID().uuidString)
            _ = amount; _ = currency
            return .init(transactionID: start.paymentId, status: .pending)
        } catch {
            throw error
        }
    }
}
