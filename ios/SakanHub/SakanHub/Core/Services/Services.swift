import Foundation

// MARK: - Payment

/// Interface for a future payment gateway (Stripe / HyperPay / Moyasar / Apple Pay).
/// Provide a real implementation later; keep the app free of vendor code.
protocol PaymentService {
    func startCheckout(amount: Double, currency: String, orderRef: String) async throws -> PaymentResult
}

struct PaymentResult {
    let transactionID: String
    let status: Status
    enum Status { case approved, declined, pending, failed(String) }
}

/// Mock: always succeeds after a short delay. Replace before shipping.
struct MockPaymentService: PaymentService {
    func startCheckout(amount: Double, currency: String, orderRef: String) async throws -> PaymentResult {
        try await Task.sleep(nanoseconds: 700_000_000)
        return .init(transactionID: "MOCK-\(UUID().uuidString.prefix(8))", status: .approved)
    }
}

// MARK: - Messaging / DM

protocol MessagingService {
    func sendMessage(propertyID: Property.ID, text: String) async throws
    func openConversation(propertyID: Property.ID) async throws -> Conversation
}

struct Conversation: Identifiable, Hashable {
    let id: String
    var propertyID: Property.ID
    var messages: [Message]
    struct Message: Identifiable, Hashable {
        let id: String
        var text: String
        var fromMe: Bool
        var sentAt: Date
    }
}

struct MockMessagingService: MessagingService {
    func sendMessage(propertyID: Property.ID, text: String) async throws {
        try await Task.sleep(nanoseconds: 200_000_000)
    }
    func openConversation(propertyID: Property.ID) async throws -> Conversation {
        .init(id: UUID().uuidString, propertyID: propertyID, messages: [])
    }
}

// MARK: - AI recommendation

/// Interface for a future AI backend (natural language search, deal scoring, summaries).
/// Never expose provider tokens on-device — the app calls YOUR backend, which calls the LLM.
protocol AIRecommendationService {
    /// "شقة شمال الرياض أقل من ٧٠٠ ألف ومساحة أكثر من ١٥٠م" → structured filter.
    func filterFromNaturalLanguage(_ prompt: String) async throws -> SearchFilter

    /// Deal-score / negotiation advice for a specific property.
    func evaluate(property: Property) async throws -> AIEvaluation

    /// Short summary the user sees on the detail page.
    func summarise(property: Property) async throws -> String
}

struct AIEvaluation {
    var dealScore: Int              // 0..100
    var negotiationPower: NegotiationPower
    var suggestedOfferSAR: Double
    var summary: String
    enum NegotiationPower { case strong, medium, low }
}

struct MockAIRecommendationService: AIRecommendationService {
    func filterFromNaturalLanguage(_ prompt: String) async throws -> SearchFilter {
        var f = SearchFilter(query: prompt)
        // Very small keyword-based mock so the UI has something to show.
        if prompt.contains("شمال")  { f.neighborhood = "شمال الرياض" }
        if prompt.contains("شقة")   { f.categories.insert(.apartment) }
        if prompt.contains("فيلا")  { f.categories.insert(.villa) }
        if let match = prompt.range(of: "\\d+", options: .regularExpression) {
            if let n = Double(prompt[match]) { f.maxPriceSAR = n * (prompt.contains("ألف") ? 1_000 : 1) }
        }
        return f
    }
    func evaluate(property: Property) async throws -> AIEvaluation {
        let fair = property.priceSAR * 0.94
        let gap = property.priceSAR - fair
        let power: AIEvaluation.NegotiationPower = gap > 2000 ? .strong : (gap > 500 ? .medium : .low)
        return .init(
            dealScore: max(20, min(98, 100 - Int((gap / property.priceSAR) * 100))),
            negotiationPower: power,
            suggestedOfferSAR: (property.priceSAR * 0.97).rounded() / 1,
            summary: "السعر ضمن النطاق المعقول لنمط \(property.category.rawValue) في \(property.location.neighborhood)."
        )
    }
    func summarise(property: Property) async throws -> String {
        "\(property.category.rawValue) \(property.rooms.map { "\($0) غرف · " } ?? "")\(Int(property.areaSquareMeters)) م² في \(property.location.neighborhood)."
    }
}

// MARK: - Sharing

/// Small facade around `UIActivityViewController` / Web Share.
enum ShareService {
    static func shareLink(for property: Property) -> URL {
        URL(string: "https://sakan.app/p/\(property.id)")!
    }
    static func shareText(for property: Property) -> String {
        "\(property.title) — \(Int(property.priceSAR)) ر.س\n\(shareLink(for: property).absoluteString)"
    }
}
