import Foundation

/// Lightweight async/await HTTP client. Extend when a real backend is wired.
/// Endpoint URLs are relative to `Config.apiBaseURL`.
struct APIClient {
    let session: URLSession
    let decoder: JSONDecoder

    init(session: URLSession = .shared) {
        self.session = session
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        d.keyDecodingStrategy = .convertFromSnakeCase
        self.decoder = d
    }

    func get<T: Decodable>(_ path: String, query: [String: String] = [:]) async throws -> T {
        try await send(path: path, method: "GET", query: query, body: Optional<Empty>.none)
    }

    func post<Body: Encodable, T: Decodable>(_ path: String, body: Body) async throws -> T {
        try await send(path: path, method: "POST", query: [:], body: body)
    }

    private func send<Body: Encodable, T: Decodable>(
        path: String, method: String, query: [String: String], body: Body?
    ) async throws -> T {
        var comps = URLComponents(url: Config.apiBaseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty {
            comps.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        var req = URLRequest(url: comps.url!)
        req.httpMethod = method
        req.addValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            req.httpBody = try JSONEncoder.iso.encode(body)
            req.addValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        do {
            let (data, resp) = try await session.data(for: req)
            guard let http = resp as? HTTPURLResponse else { throw APIError.decoding("not HTTPURLResponse") }
            switch http.statusCode {
            case 200..<300:
                if T.self == Empty.self { return Empty() as! T }
                return try decoder.decode(T.self, from: data)
            case 401: throw APIError.unauthorized
            case 404: throw APIError.notFound
            case 400: throw APIError.badRequest(String(data: data, encoding: .utf8) ?? "")
            default:  throw APIError.http(http.statusCode, message: String(data: data, encoding: .utf8))
            }
        } catch let e as URLError { throw APIError.network(e) }
    }

    struct Empty: Codable, Equatable {}
}

private extension JSONEncoder {
    static let iso: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        e.keyEncodingStrategy = .convertToSnakeCase
        return e
    }()
}
