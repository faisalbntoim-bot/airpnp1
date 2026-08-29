import SwiftUI

/// Read-only status of a payment + any refunds on it. Reads the /v1/payments/:id
/// projection; the server is the source of truth.
@MainActor
final class RefundStatusViewModel: ObservableObject {
    @Published var payment: APIPayment?
    @Published var loading = true
    @Published var errorMessage: String?

    private let payments: HttpPaymentServiceProtocol
    init(payments: HttpPaymentServiceProtocol = RepositoryFactory.payments()) { self.payments = payments }

    func load(paymentId: String) async {
        errorMessage = nil
        do {
            payment = try await payments.paymentStatus(id: paymentId)
        } catch let e as APIError {
            errorMessage = e.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }
        loading = false
    }
}

struct RefundStatusView: View {
    let paymentId: String
    @StateObject private var vm = RefundStatusViewModel()

    var body: some View {
        Group {
            if let p = vm.payment {
                Form {
                    Section("الدفعة") {
                        LabeledContent("المعرّف") { Text(p.id).font(.caption.monospaced()) }
                        LabeledContent("الحالة") { Text(Self.label(p.status)) }
                        LabeledContent("المبلغ") { Text(p.grossAmountHalalahs.formatted(currency: p.currency)).monospacedDigit() }
                    }
                    NavigationLink("طلب استرداد جديد") { RefundRequestView(paymentId: p.id) }
                        .disabled(p.status != .captured && p.status != .partialRefunded)
                }
            } else if let m = vm.errorMessage {
                ContentUnavailableView(m, systemImage: "exclamationmark.triangle")
            } else if vm.loading {
                ProgressView()
            }
        }
        .navigationTitle("حالة الدفعة")
        .navigationBarTitleDisplayMode(.inline)
        .task { await vm.load(paymentId: paymentId) }
    }

    static func label(_ s: APIPaymentStatus) -> String {
        switch s {
        case .pending:          return "قيد الدفع"
        case .captured:         return "مدفوعة"
        case .failed:           return "فشلت"
        case .refunded:         return "مستردّة"
        case .partialRefunded:  return "استرداد جزئي"
        case .cancelled:        return "ملغاة"
        }
    }
}
