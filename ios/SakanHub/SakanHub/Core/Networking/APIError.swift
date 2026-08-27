import Foundation

enum APIError: Error, LocalizedError, Equatable {
    case network(URLError)
    case decoding(String)
    case http(Int, message: String?)
    case unauthorized
    case notFound
    case badRequest(String)
    case notImplemented

    var errorDescription: String? {
        switch self {
        case .network(let e):        return "خطأ اتصال: \(e.localizedDescription)"
        case .decoding(let s):       return "تعذّر قراءة الاستجابة: \(s)"
        case .http(let c, let m):    return "خطأ الخادم (\(c)): \(m ?? "")"
        case .unauthorized:          return "الجلسة غير صالحة، يرجى تسجيل الدخول"
        case .notFound:              return "العنصر غير موجود"
        case .badRequest(let s):     return "طلب غير صالح: \(s)"
        case .notImplemented:        return "الميزة قيد التطوير"
        }
    }
}
