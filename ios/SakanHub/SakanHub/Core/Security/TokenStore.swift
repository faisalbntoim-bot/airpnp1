import Foundation

/// Persistent store for the current session's access + refresh tokens.
/// Backed by the Keychain — never UserDefaults.
///
/// Access token: short-lived JWT (~15 min). Refresh token: 30 days, one-time-use
/// and rotated on `/v1/auth/refresh`. `logout()` wipes both.
actor TokenStore {
    static let shared = TokenStore()

    private enum Key {
        static let access  = "auth.access_token"
        static let refresh = "auth.refresh_token"
    }

    private var cachedAccess: String?
    private var cachedRefresh: String?

    init() {
        cachedAccess  = try? Keychain.readString(forKey: Key.access)
        cachedRefresh = try? Keychain.readString(forKey: Key.refresh)
    }

    func accessToken()  -> String? { cachedAccess }
    func refreshToken() -> String? { cachedRefresh }

    func save(access: String, refresh: String) throws {
        try Keychain.saveString(access,  forKey: Key.access)
        try Keychain.saveString(refresh, forKey: Key.refresh)
        cachedAccess  = access
        cachedRefresh = refresh
    }

    func updateAccessOnly(_ access: String) throws {
        try Keychain.saveString(access, forKey: Key.access)
        cachedAccess = access
    }

    func clear() {
        Keychain.delete(forKey: Key.access)
        Keychain.delete(forKey: Key.refresh)
        cachedAccess = nil
        cachedRefresh = nil
    }
}
