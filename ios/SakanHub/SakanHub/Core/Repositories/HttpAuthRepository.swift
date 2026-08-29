import Foundation

/// Real OTP + JWT flow against the SakanHub backend.
protocol AuthRepository {
    func requestOtp(phone: String) async throws -> APIOtpRequestResult
    func verifyOtp(requestId: String, phone: String, code: String, nameAr: String?) async throws -> APIAuthResult
    func me() async throws -> APIUser
    func logout() async throws
    func deleteAccount(reason: String?) async throws
}

struct HttpAuthRepository: AuthRepository {
    let client: APIClient
    init(client: APIClient = .shared) { self.client = client }

    func requestOtp(phone: String) async throws -> APIOtpRequestResult {
        struct Req: Encodable { let phone: String }
        return try await client.post("/v1/auth/otp", body: Req(phone: phone), authed: false)
    }

    func verifyOtp(requestId: String, phone: String, code: String, nameAr: String? = nil) async throws -> APIAuthResult {
        struct Req: Encodable { let requestId: String; let phone: String; let code: String; let nameAr: String? }
        let result: APIAuthResult = try await client.post("/v1/auth/otp/verify",
            body: Req(requestId: requestId, phone: phone, code: code, nameAr: nameAr),
            authed: false)
        try await TokenStore.shared.save(access: result.accessToken, refresh: result.refreshToken)
        return result
    }

    func me() async throws -> APIUser {
        try await client.get("/v1/auth/me")
    }

    func logout() async throws {
        struct Req: Encodable { let refreshToken: String }
        let refresh = await TokenStore.shared.refreshToken()
        if let refresh {
            let _: APIClient.Empty = try await client.post("/v1/auth/logout", body: Req(refreshToken: refresh))
        }
        await TokenStore.shared.clear()
    }

    func deleteAccount(reason: String? = nil) async throws {
        struct Req: Encodable { let confirm: String; let reason: String? }
        let _: APIClient.Empty = try await client.delete("/v1/account", body: Req(confirm: "DELETE", reason: reason))
        await TokenStore.shared.clear()
    }
}
