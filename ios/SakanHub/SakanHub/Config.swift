import Foundation

/// Runtime configuration read from `Info.plist` at launch.
/// NEVER hard-code API keys/secrets in source. Add them to a `.xcconfig`
/// that feeds into Info.plist via `$(VARIABLE)` substitution, and keep
/// `Secrets.xcconfig` out of version control (see `.gitignore`).
enum Config {
    static let apiBaseURL: URL = {
        let s = (Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String) ?? "https://api.sakan.local"
        return URL(string: s)!
    }()

    /// Optional. Empty string means "not configured".
    static var mapsAPIKey: String {
        (Bundle.main.object(forInfoDictionaryKey: "MAPS_API_KEY") as? String) ?? ""
    }

    /// Optional. Used only when a cloud renderer is wired.
    static var gaussianSplatRendererURL: String {
        (Bundle.main.object(forInfoDictionaryKey: "GS_RENDERER_URL") as? String) ?? ""
    }

    /// Toggle mocks vs real services.
    static var useMocks: Bool {
        let raw = (Bundle.main.object(forInfoDictionaryKey: "USE_MOCKS") as? String) ?? "YES"
        return (raw as NSString).boolValue
    }
}
