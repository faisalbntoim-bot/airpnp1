import Foundation

/// Invoice reads. Invoice numbers are ONLY minted by the backend — never on iOS.
/// PDF / XML links are opaque server-side references; consult
/// `docs/API_CONTRACT.md` for their meaning (both nullable while ZATCA
/// integration is pending).
protocol InvoiceRepository {
    func invoice(id: String) async throws -> APIInvoice
}

struct HttpInvoiceRepository: InvoiceRepository {
    let client: APIClient
    init(client: APIClient = .shared) { self.client = client }

    func invoice(id: String) async throws -> APIInvoice {
        try await client.get("/v1/invoices/\(id)")
    }
}
