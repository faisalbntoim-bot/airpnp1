import Foundation

/// Real bookings against the backend. The engine is the source of truth for
/// pricing (`APIQuote`) and confirmation (`APIBooking.status`).
struct HttpBookingRepository: BookingRepository {
    let client: APIClient
    init(client: APIClient = .shared) { self.client = client }

    func list(forGuest _: User.ID) async throws -> [Booking] {
        // The backend scopes /v1/bookings by the JWT — the guestId parameter is
        // ignored on purpose (the caller can only see their OWN bookings).
        let page: APIPagedBookings = try await client.get("/v1/bookings", query: ["page": "1", "pageSize": "50"])
        return page.items.map(Self.toDomain(_:))
    }

    func availability(for propertyID: Property.ID) async throws -> Set<Date> {
        // Legacy signature returns a set of blocked days. Real callers should query the API by cuid
        // via `apiAvailability(...)` — this legacy path returns an empty set.
        _ = propertyID
        return []
    }

    func create(_ booking: Booking) async throws -> Booking {
        // Legacy shape — real callers use `createBooking(...)` with API types.
        return booking
    }

    func cancel(id _: Booking.ID) async throws {
        // No public cancellation endpoint yet — reserved.
    }

    // MARK: - Real API surface (preferred)

    struct CreateInput: Encodable {
        let propertyId: String
        let transactionType: String
        let grossAmount: String
        let currency: String
        let nights: Int?
        let checkIn: String?
        let checkOut: String?
    }

    func createBooking(_ input: CreateInput, idempotencyKey: String? = nil) async throws -> APICreateBookingResult {
        try await client.post("/v1/bookings", body: input, idempotencyKey: idempotencyKey)
    }

    func fetchBooking(id: String) async throws -> APIBooking {
        try await client.get("/v1/bookings/\(id)")
    }

    func quote(input: QuoteInput) async throws -> APIQuote {
        try await client.post("/v1/quote", body: input, authed: false)
    }

    struct QuoteInput: Encodable {
        let transactionType: String
        let propertyType: String?
        let grossAmount: String
        let currency: String
    }

    func apiList(page: Int = 1, pageSize: Int = 20, status: String? = nil) async throws -> APIPagedBookings {
        var q: [String: String] = ["page": String(page), "pageSize": String(pageSize)]
        if let status { q["status"] = status }
        return try await client.get("/v1/bookings", query: q)
    }

    // MARK: - Projection

    static func toDomain(_ b: APIBooking) -> Booking {
        Booking(
            id: b.id,
            propertyID: b.propertyId,
            guestID: b.customerId,
            checkIn: b.checkIn ?? .distantPast,
            checkOut: b.checkOut ?? .distantPast,
            nights: b.nights ?? 0,
            pricePerNightSAR: 0,
            cleaningFeeSAR: 0,
            serviceFeeSAR: 0,
            vatSAR: 0,
            totalSAR: NSDecimalNumber(decimal: b.grossAmountHalalahs.majorDecimal).doubleValue,
            status: Self.toLegacyStatus(b.status),
            createdAt: b.createdAt
        )
    }

    private static func toLegacyStatus(_ s: APIBookingStatus) -> Booking.Status {
        switch s {
        case .draft, .pendingPayment: return .pending
        case .confirmed:              return .confirmed
        case .cancelled:              return .cancelled
        case .completed:              return .completed
        }
    }
}
