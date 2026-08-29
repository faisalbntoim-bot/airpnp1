import Foundation

/// Runtime environment resolved from Info.plist / xcconfig.
///
/// PRODUCTION build MUST NOT permit mocks. Compile-time guarantee:
/// the Production scheme sets `PRODUCTION` in "Active Compilation Conditions"
/// which flips `useMocks` to a hard `false`. There is no other override.
enum AppEnvironment {
    static var apiBaseURL: URL {
        let raw = (Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String)?.trimmingCharacters(in: .whitespaces)
        guard let raw, !raw.isEmpty, let url = URL(string: raw) else {
            #if PRODUCTION
            preconditionFailure("API_BASE_URL is not set for the Production scheme")
            #else
            return URL(string: "http://localhost:4000")!
            #endif
        }
        #if PRODUCTION
        precondition(url.scheme?.lowercased() == "https", "Production API must be HTTPS")
        #endif
        return url
    }

    /// Mocks are only ever considered outside Production.
    static var useMocks: Bool {
        #if PRODUCTION
        return false
        #else
        let raw = (Bundle.main.object(forInfoDictionaryKey: "USE_MOCKS") as? String) ?? "YES"
        return (raw as NSString).boolValue
        #endif
    }

    static var name: String {
        #if PRODUCTION
        return "production"
        #elseif STAGING
        return "staging"
        #else
        return "development"
        #endif
    }
}
