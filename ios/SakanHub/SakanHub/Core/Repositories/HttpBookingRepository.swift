import Foundation

/// Real bookings against the backend. The engine is the source of truth for
/// pricing (`APIQuote`) and confirmation (`APIBooking.status`).
struct HttpBookingRepository: BookingRepository {
    let client: APIClient
    init(client: APIClient = .shared) { self.client = client }

    func list(forGuest _: User.ID) async throws -> [Booking] {
        // The backend currently exposes /v1/bookings/:id but no per-user list — reserved for future.
        []
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
}
