/**
 * Codable models that mirror `docs/API_CONTRACT.md`.
 *
 * Distinct from the legacy in-app models (`Core/Models/*.swift`) so the
 * existing SwiftUI code and previews keep compiling with the mock repos.
 * Real HTTP repositories decode into these API* types and, where needed,
 * project them into the legacy view models via `toDomain()` adapters.
 */

import Foundation

// MARK: - Enums (values match backend exactly)

enum APIRole: String, Codable, Sendable {
    case customer     = "CUSTOMER"
    case host         = "HOST"
    case owner        = "OWNER"
    case office       = "OFFICE"
    case marketer     = "MARKETER"
    case admin        = "ADMIN"
    case financeAdmin = "FINANCE_ADMIN"
    case superAdmin   = "SUPER_ADMIN"
}

enum APIPropertyCategory: String, Codable, Sendable {
    case apartment, villa, duplex, studio, land, office, shop, farm, commercial, building
}

enum APIPropertyPurpose: String, Codable, Sendable {
    case sale, rent, daily, monthly
    case commercialRent = "commercial_rent"
}

enum APIPropertyStatus: String, Codable, Sendable {
    case available, reserved, sold, rented, hidden
}

enum APITransactionType: String, Codable, Sendable {
    case dailyRental        = "DAILY_RENTAL"
    case longTermRental     = "LONG_TERM_RENTAL"
    case commercialRental   = "COMMERCIAL_RENTAL"
    case sale               = "SALE"
    case advertisement      = "ADVERTISEMENT"
    case subscription       = "SUBSCRIPTION"
    case service            = "SERVICE"
}

enum APIBookingStatus: String, Codable, Sendable {
    case draft, pendingPayment = "pending_payment", confirmed, cancelled, completed
}

enum APIPaymentStatus: String, Codable, Sendable {
    case pending, captured, failed, refunded
    case partialRefunded = "partial_refunded"
    case cancelled
}

enum APIRefundStatus: String, Codable, Sendable {
    case pending, processing, completed, failed, cancelled
}

enum APISettlementStatus: String, Codable, Sendable {
    case pending    = "PENDING"
    case eligible   = "ELIGIBLE"
    case processing = "PROCESSING"
    case paid       = "PAID"
    case failed     = "FAILED"
    case cancelled  = "CANCELLED"
}

enum APIInvoiceStatus: String, Codable, Sendable {
    case draft, issued, credited, cancelled
}

// MARK: - User / Auth

struct APIUser: Codable, Hashable, Sendable {
    let id: String
    let phone: String
    let email: String?
    let nameAr: String
    let nameEn: String?
    /// Present on `/v1/auth/me`, absent on some other endpoints.
    let role: APIRole?
    let currentRole: APIRole?
    let roles: [APIRole]?
}

struct APIAuthResult: Codable, Sendable {
    let user: APIUser
    let accessToken: String
    let refreshToken: String
    let accessExpiresIn: Int
    let refreshExpiresIn: Int
}

struct APIOtpRequestResult: Codable, Sendable {
    let requestId: String
    let expiresInSeconds: Int
}

struct APITokenPair: Codable, Sendable {
    let accessToken: String
    let refreshToken: String
    let accessExpiresIn: Int
    let refreshExpiresIn: Int
}

// MARK: - Property

struct APIProperty: Codable, Hashable, Sendable {
    let id: String
    let listingNumber: String
    let category: String                            // decoded as raw string — enum-safe
    let purpose: String
    let status: String
    let currency: String
    let createdAt: Date
    let updatedAt: Date
    /// Owner id is present only for admin / owner views (public projection strips it).
    let ownerId: String?
    let officeId: String?
}

struct APIPagedProperties: Codable, Sendable {
    let items: [APIProperty]
    let page: Int
    let pageSize: Int
    let total: Int
}

struct APIAvailability: Codable, Sendable {
    let propertyId: String
    let from: Date
    let to: Date
    let isAvailable: Bool
    let bookedRanges: [APIBookedRange]

    struct APIBookedRange: Codable, Sendable {
        let from: Date
        let to: Date
        let bookingId: String
        let status: String
    }
}

// MARK: - Booking / Quote / Payment

struct APIQuoteCommission: Codable, Sendable {
    let ruleId: String?
    let platformFeeHalalahs: Money
    let officeShareHalalahs: Money
    let marketerShareHalalahs: Money
    let ownerAmountHalalahs: Money
    let hostAmountHalalahs: Money
    let currency: String
}

struct APIQuoteTax: Codable, Sendable {
    let status: String                              // applied | exempt | not_applicable
    let ratePercent: Double
    let taxableAmountHalalahs: Money
    let taxAmountHalalahs: Money
    let reasonCode: String?
}

struct APIQuote: Codable, Sendable {
    let currency: String
    let transactionType: APITransactionType
    let grossAmountHalalahs: Money
    let commission: APIQuoteCommission
    let taxOnPlatformFee: APIQuoteTax
    let taxOnRental: APIQuoteTax
    let customerTotalHalalahs: Money
    let platformNetRevenueHalalahs: Money
}

struct APIBooking: Codable, Sendable {
    let id: String
    let propertyId: String
    let customerId: String
    let hostId: String
    let officeId: String?
    let marketerId: String?
    let transactionType: APITransactionType
    let checkIn: Date?
    let checkOut: Date?
    let nights: Int?
    let grossAmountHalalahs: Money
    let currency: String
    let status: APIBookingStatus
    let createdAt: Date
    let confirmedAt: Date?
}

struct APICreateBookingResult: Codable, Sendable {
    let booking: APIBooking
    let quote: APIQuote
}

struct APIPayment: Codable, Sendable {
    let id: String
    let bookingId: String?
    let type: String
    let grossAmountHalalahs: Money
    let currency: String
    let status: APIPaymentStatus
    let provider: String
    let providerPaymentId: String?
    let providerStatus: String?
    let gatewayFeeHalalahs: Money?
    let createdAt: Date
    let capturedAt: Date?
}

struct APIStartCheckoutResult: Codable, Sendable {
    let paymentId: String
    let providerPaymentId: String
    let redirectUrl: String?
    let quote: APIQuote
}

// MARK: - Wallet / Settlement / Invoice / Refund

struct APIWallet: Codable, Sendable {
    let availableHalalahs: Money
    let pendingHalalahs: Money
    let paidHalalahs: Money
    let refundedHalalahs: Money
    let failedHalalahs: Money
    let totalEarningsHalalahs: Money
    let ledger: APIWalletLedger

    struct APIWalletLedger: Codable, Sendable {
        let hostPayable: Money
        let ownerPayable: Money
        let officePayable: Money
        let marketerPayable: Money
    }
}

struct APISettlement: Codable, Sendable {
    let id: String
    let paymentId: String
    let beneficiaryId: String
    let amountHalalahs: Money
    let currency: String
    let status: APISettlementStatus
    let scheduledAt: Date?
    let processedAt: Date?
    let providerReference: String?
    let failureReason: String?
    let retryCount: Int?
}

struct APIInvoice: Codable, Sendable {
    let id: String
    let invoiceNumber: String
    let sellerName: String
    let sellerVatNumber: String?
    let buyerName: String
    let buyerVatNumber: String?
    let subtotalHalalahs: Money
    let taxableAmountHalalahs: Money
    let taxRatePercent: Double
    let taxAmountHalalahs: Money
    let totalHalalahs: Money
    let currency: String
    let issueDate: Date
    let status: APIInvoiceStatus
    let pdfRef: String?
    let xmlRef: String?
}

struct APIRefundResult: Codable, Sendable {
    let refundId: String
    let providerRefundId: String?
    let amountHalalahs: Money
    let status: APIRefundStatus
}

// MARK: - Paged envelopes

struct APIPagedBookings: Codable, Sendable {
    let items: [APIBooking]
    let page: Int
    let pageSize: Int
    let total: Int
}

struct APIPagedInvoices: Codable, Sendable {
    let items: [APIInvoice]
    let page: Int
    let pageSize: Int
    let total: Int
}
