import Foundation

/// Invoice reads. Invoice numbers are ONLY minted by the backend — never on iOS.
/// PDF / XML links are opaque server-side references; consult
/// `docs/API_CONTRACT.md` for their meaning (both nullable while ZATCA
/// integration is pending).
protocol InvoiceRepository {
    func invoice(id: String) async throws -> APIInvoice
    func invoices(page: Int, pageSize: Int, status: String?) async throws -> APIPagedInvoices
}

struct HttpInvoiceRepository: InvoiceRepository {
    let client: APIClient
    init(client: APIClient = .shared) { self.client = client }

    func invoice(id: String) async throws -> APIInvoice {
        try await client.get("/v1/invoices/\(id)")
    }

    func invoices(page: Int = 1, pageSize: Int = 20, status: String? = nil) async throws -> APIPagedInvoices {
        var q: [String: String] = ["page": String(page), "pageSize": String(pageSize)]
        if let status { q["status"] = status }
        return try await client.get("/v1/invoices", query: q)
    }
}
