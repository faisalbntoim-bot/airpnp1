import Foundation

/// Real payment flow: start checkout on our backend, redirect the user to the
/// PSP's hosted page, then re-read the payment status from our backend
/// (which is fed by the verified webhook).
///
/// SECRETS: this file contains NO PSP secret keys. Only server-safe fields
/// (redirect URL, booking id, payment id, quote) leave the server.
protocol HttpPaymentServiceProtocol {
    func startCheckout(bookingId: String, returnUrl: URL?, idempotencyKey: String?) async throws -> APIStartCheckoutResult
    func paymentStatus(id: String) async throws -> APIPayment
    func requestRefund(paymentId: String, amountMajor: String?, reason: String?, idempotencyKey: String?) async throws -> APIRefundResult
}

struct HttpPaymentService: HttpPaymentServiceProtocol {
    let client: APIClient
    init(client: APIClient = .shared) { self.client = client }

    private struct StartReq: Encodable {
        let bookingId: String
        let returnUrl: String?
    }

    func startCheckout(bookingId: String, returnUrl: URL?, idempotencyKey: String? = nil) async throws -> APIStartCheckoutResult {
        try await client.post("/v1/payments",
                              body: StartReq(bookingId: bookingId, returnUrl: returnUrl?.absoluteString),
                              idempotencyKey: idempotencyKey)
    }

    func paymentStatus(id: String) async throws -> APIPayment {
        try await client.get("/v1/payments/\(id)")
    }

    private struct RefundReq: Encodable {
        let amount: String?
        let reason: String?
    }

    func requestRefund(paymentId: String, amountMajor: String?, reason: String?, idempotencyKey: String? = nil) async throws -> APIRefundResult {
        try await client.post("/v1/payments/\(paymentId)/refund",
                              body: RefundReq(amount: amountMajor, reason: reason),
                              idempotencyKey: idempotencyKey)
    }
}
