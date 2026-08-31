import Foundation
import Security

/// Thin `SecItem`-backed store. Data lives in the iOS Keychain — never
/// UserDefaults, never a plain file. Values are per-app (`kSecAttrService`
/// = bundle id + a suffix) and accessible only after the device is unlocked
/// once (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`).
///
/// Not suitable for extremely-sensitive material (private keys used in
/// live crypto operations) — those want the Secure Enclave. For OAuth
/// bearer + refresh tokens this is the recommended baseline.
enum Keychain {
    enum KeychainError: Error {
        case unhandled(OSStatus)
        case notFound
        case badData
    }

    private static let service = (Bundle.main.bundleIdentifier ?? "sakan.hub") + ".tokens"

    static func save(_ data: Data, forKey key: String) throws {
        let base: [String: Any] = [
            kSecClass as String:            kSecClassGenericPassword,
            kSecAttrService as String:      service,
            kSecAttrAccount as String:      key,
            kSecAttrAccessible as String:   kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]

        // Try an update first.
        let update: [String: Any] = [kSecValueData as String: data]
        let updated = SecItemUpdate(base as CFDictionary, update as CFDictionary)
        if updated == errSecSuccess { return }
        if updated != errSecItemNotFound { throw KeychainError.unhandled(updated) }

        var add = base
        add[kSecValueData as String] = data
        let added = SecItemAdd(add as CFDictionary, nil)
        guard added == errSecSuccess else { throw KeychainError.unhandled(added) }
    }

    static func read(forKey key: String) throws -> Data {
        let query: [String: Any] = [
            kSecClass as String:            kSecClassGenericPassword,
            kSecAttrService as String:      service,
            kSecAttrAccount as String:      key,
            kSecReturnData as String:       true,
            kSecMatchLimit as String:       kSecMatchLimitOne,
        ]
        var out: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &out)
        if status == errSecItemNotFound { throw KeychainError.notFound }
        guard status == errSecSuccess else { throw KeychainError.unhandled(status) }
        guard let data = out as? Data else { throw KeychainError.badData }
        return data
    }

    @discardableResult
    static func delete(forKey key: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String:            kSecClassGenericPassword,
            kSecAttrService as String:      service,
            kSecAttrAccount as String:      key,
        ]
        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }
}

// String convenience helpers.
extension Keychain {
    static func saveString(_ value: String, forKey key: String) throws {
        try save(Data(value.utf8), forKey: key)
    }
    static func readString(forKey key: String) throws -> String {
        let d = try read(forKey: key)
        guard let s = String(data: d, encoding: .utf8) else { throw KeychainError.badData }
        return s
    }
}
