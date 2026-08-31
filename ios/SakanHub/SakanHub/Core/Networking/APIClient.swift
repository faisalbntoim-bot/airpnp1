import Foundation

/// Real REST client for the SakanHub backend.
///
/// - Attaches `Authorization: Bearer <access>` when a token is stored.
/// - On 401 it calls `/v1/auth/refresh` once (with a lock) and replays the
///   original request. A second 401 clears the session and surfaces
///   `.unauthorized` so the UI can send the user back to Login.
/// - Maps 400/401/403/404/409/422/429/5xx to `APIError` variants.
/// - Sensitive data (Bearer, tokens) is NEVER logged.
final class APIClient {

    static let shared = APIClient()

    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder
    private let base: URL
    private let refreshLock = AsyncLock()

    init(session: URLSession = APIClient.makeSession(), baseURL: URL = AppEnvironment.apiBaseURL) {
        self.session = session
        self.base = baseURL
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        self.decoder = d
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        self.encoder = e
    }

    private static func makeSession() -> URLSession {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 20
        cfg.timeoutIntervalForResource = 45
        cfg.waitsForConnectivity = true
        cfg.httpAdditionalHeaders = ["Accept": "application/json"]
        return URLSession(configuration: cfg)
    }

    // MARK: - Verbs

    func get<T: Decodable>(_ path: String, query: [String: String] = [:], authed: Bool = true) async throws -> T {
        try await send(path: path, method: "GET", query: query, body: Optional<Empty>.none, authed: authed)
    }

    func post<Body: Encodable, T: Decodable>(_ path: String, body: Body, authed: Bool = true, idempotencyKey: String? = nil) async throws -> T {
        try await send(path: path, method: "POST", query: [:], body: body, authed: authed, idempotencyKey: idempotencyKey)
    }

    func patch<Body: Encodable, T: Decodable>(_ path: String, body: Body, authed: Bool = true) async throws -> T {
        try await send(path: path, method: "PATCH", query: [:], body: body, authed: authed)
    }

    func delete<Body: Encodable, T: Decodable>(_ path: String, body: Body, authed: Bool = true) async throws -> T {
        try await send(path: path, method: "DELETE", query: [:], body: body, authed: authed)
    }

    struct Empty: Codable, Equatable {}

    // MARK: - Core

    private func send<Body: Encodable, T: Decodable>(
        path: String, method: String, query: [String: String],
        body: Body?, authed: Bool,
        idempotencyKey: String? = nil,
        alreadyRetriedAfter401: Bool = false
    ) async throws -> T {
        let req = try await makeRequest(path: path, method: method, query: query, body: body, authed: authed, idempotencyKey: idempotencyKey)
        let (data, resp): (Data, URLResponse)
        do {
            (data, resp) = try await session.data(for: req)
        } catch let urlErr as URLError {
            if urlErr.code == .cancelled { throw APIError.cancelled }
            throw APIError.network(urlErr)
        }
        guard let http = resp as? HTTPURLResponse else {
            throw APIError.decoding("not HTTPURLResponse")
        }

        switch http.statusCode {
        case 200..<300:
            if T.self == Empty.self { return Empty() as! T }
            if data.isEmpty {
                // Some 200/204 responses have no body — attempt an empty-object decode as a fallback.
                let empty = "{}".data(using: .utf8)!
                return try decoder.decode(T.self, from: empty)
            }
            do { return try decoder.decode(T.self, from: data) }
            catch { throw APIError.decoding(String(describing: error)) }

        case 401:
            if authed && !alreadyRetriedAfter401 {
                let refreshed = await tryRefreshOnce()
                if refreshed {
                    return try await send(path: path, method: method, query: query, body: body,
                                          authed: authed, idempotencyKey: idempotencyKey,
                                          alreadyRetriedAfter401: true)
                }
            }
            // Refresh failed or we've already retried — clear the session.
            await TokenStore.shared.clear()
            throw APIError.unauthorized

        case 400: throw APIError.badRequest(decodeMessage(data))
        case 403: throw APIError.forbidden(decodeMessage(data))
        case 404: throw APIError.notFound
        case 409: throw APIError.conflict(decodeMessage(data))
        case 422: throw APIError.validation(decodeMessage(data))
        case 429: throw APIError.tooManyRequests
        case 500..<600: throw APIError.server(http.statusCode, decodeMessage(data))
        default:  throw APIError.server(http.statusCode, decodeMessage(data))
        }
    }

    private func makeRequest<Body: Encodable>(
        path: String, method: String, query: [String: String],
        body: Body?, authed: Bool, idempotencyKey: String?
    ) async throws -> URLRequest {
        var comps = URLComponents(url: base.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty {
            comps.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        var req = URLRequest(url: comps.url!)
        req.httpMethod = method
        req.addValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            req.httpBody = try encoder.encode(body)
            req.addValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if let idempotencyKey {
            req.addValue(idempotencyKey, forHTTPHeaderField: "Idempotency-Key")
        }
        if authed, let access = await TokenStore.shared.accessToken() {
            req.addValue("Bearer \(access)", forHTTPHeaderField: "Authorization")
        }
        return req
    }

    private func decodeMessage(_ data: Data) -> String? {
        (try? decoder.decode(APIErrorBody.self, from: data))?.message
    }

    // MARK: - Refresh

    private func tryRefreshOnce() async -> Bool {
        await refreshLock.run {
            // Re-check inside the critical section — another concurrent request may have refreshed already.
            guard let refresh = await TokenStore.shared.refreshToken() else { return false }
            struct Req: Encodable { let refreshToken: String }
            struct Resp: Decodable { let accessToken: String; let refreshToken: String }
            do {
                let req = try await makeRequest(path: "/v1/auth/refresh", method: "POST", query: [:], body: Req(refreshToken: refresh), authed: false, idempotencyKey: nil)
                let (data, resp) = try await session.data(for: req)
                guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { return false }
                let pair = try self.decoder.decode(Resp.self, from: data)
                try await TokenStore.shared.save(access: pair.accessToken, refresh: pair.refreshToken)
                return true
            } catch {
                return false
            }
        }
    }
}

/// Tiny FIFO mutex — Swift 5.9 stdlib doesn't ship one and we need to serialise refresh.
actor AsyncLock {
    private var busy = false
    private var waiters: [CheckedContinuation<Void, Never>] = []

    func run<T>(_ body: () async -> T) async -> T {
        await lock()
        defer { unlock() }
        return await body()
    }

    private func lock() async {
        if !busy { busy = true; return }
        await withCheckedContinuation { (c: CheckedContinuation<Void, Never>) in
            waiters.append(c)
        }
    }

    private func unlock() {
        if let next = waiters.first {
            waiters.removeFirst()
            next.resume()
        } else {
            busy = false
        }
    }
}
