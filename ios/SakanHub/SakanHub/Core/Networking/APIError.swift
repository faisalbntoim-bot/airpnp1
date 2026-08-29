import Foundation

/// Backend error envelope: `{ error, message, details? }` — see docs/API_CONTRACT.md.
struct APIErrorBody: Decodable, Equatable {
    let error: String?
    let message: String?
}

enum APIError: Error, LocalizedError, Equatable {
    case network(URLError)
    case decoding(String)
    case badRequest(String?)                     // 400
    case validation(String?)                     // 422 (Zod-style)
    case unauthorized                             // 401 — token missing / expired
    case forbidden(String?)                      // 403
    case notFound                                 // 404
    case conflict(String?)                       // 409 — idempotency / illegal state
    case tooManyRequests                          // 429
    case server(Int, String?)                    // 5xx
    case notImplemented
    case cancelled

    var errorDescription: String? {
        switch self {
        case .network(let e):        return "خطأ اتصال: \(e.localizedDescription)"
        case .decoding(let s):       return "تعذّر قراءة الاستجابة: \(s)"
        case .badRequest(let m):     return m ?? "طلب غير صالح"
        case .validation(let m):     return m ?? "تحقق من المدخلات"
        case .unauthorized:          return "الجلسة انتهت — يرجى تسجيل الدخول"
        case .forbidden(let m):      return m ?? "لا تملك صلاحية لهذا الإجراء"
        case .notFound:              return "العنصر غير موجود"
        case .conflict(let m):       return m ?? "لا يمكن إتمام العملية"
        case .tooManyRequests:       return "محاولات كثيرة — أعد المحاولة لاحقاً"
        case .server(let c, let m):  return m ?? "خطأ في الخادم (\(c))"
        case .notImplemented:        return "الميزة قيد التطوير"
        case .cancelled:             return "تم إلغاء الطلب"
        }
    }

    /// User-safe: never expose stack traces / internal ids.
    var isRetryable: Bool {
        switch self {
        case .network, .tooManyRequests, .server: return true
        default: return false
        }
    }
}
