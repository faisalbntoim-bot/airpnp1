import Foundation

/// Money in halalahs — the same shape the backend uses.
///
/// - Wire format: JSON string of an integer number of halalahs
///   (`"31725"` = 317.25 SAR). We store the raw string to preserve precision
///   through any bit-width; a `Decimal` accessor is provided for display.
/// - NEVER use `Double` or `Float` for money in this app.
///
/// See `docs/API_CONTRACT.md`.
struct Money: Codable, Hashable, Sendable {
    let halalahs: String                        // integer as string, e.g. "31725"

    init(halalahs: String) { self.halalahs = halalahs }
    init(halalahsInt: Int64) { self.halalahs = String(halalahsInt) }

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let s = try? c.decode(String.self) {
            guard s.allSatisfy({ $0 == "-" || $0.isNumber }) else {
                throw DecodingError.dataCorruptedError(in: c, debugDescription: "expected halalahs string; got \(s)")
            }
            self.halalahs = s
        } else if let n = try? c.decode(Int64.self) {
            self.halalahs = String(n)
        } else {
            throw DecodingError.dataCorruptedError(in: c, debugDescription: "expected money as string or integer")
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        try c.encode(halalahs)
    }

    /// Precise SAR value for display / totals. Never round in the UI —
    /// present as-is with 2 fraction digits.
    var majorDecimal: Decimal {
        let d = Decimal(string: halalahs) ?? 0
        return d / 100
    }

    /// Localised display, e.g. "317.25 SAR". The unit label is chosen by the caller.
    func formatted(currency: String = "SAR", locale: Locale = .init(identifier: "ar_SA")) -> String {
        let n = NSDecimalNumber(decimal: majorDecimal)
        let f = NumberFormatter()
        f.locale = locale
        f.numberStyle = .decimal
        f.minimumFractionDigits = 2
        f.maximumFractionDigits = 2
        let s = f.string(from: n) ?? "\(n)"
        return "\(s) \(currency)"
    }
}
