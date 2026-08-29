import SwiftUI

@MainActor
final class RefundRequestViewModel: ObservableObject {
    @Published var amountMajor: String = ""       // empty = full refund
    @Published var reason: String = ""
    @Published var loading = false
    @Published var errorMessage: String?
    @Published var result: APIRefundResult?

    let paymentId: String
    private let payments: HttpPaymentServiceProtocol
    init(paymentId: String, payments: HttpPaymentServiceProtocol = RepositoryFactory.payments()) {
        self.paymentId = paymentId
        self.payments = payments
    }

    func submit() async {
        errorMessage = nil
        loading = true
        defer { loading = false }
        do {
            let amount = amountMajor.trimmingCharacters(in: .whitespaces)
            result = try await payments.requestRefund(
                paymentId: paymentId,
                amountMajor: amount.isEmpty ? nil : amount,
                reason: reason.isEmpty ? nil : reason,
                idempotencyKey: UUID().uuidString
            )
        } catch let e as APIError {
            errorMessage = e.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct RefundRequestView: View {
    @StateObject private var vm: RefundRequestViewModel
    @Environment(\.dismiss) private var dismiss

    init(paymentId: String) {
        _vm = StateObject(wrappedValue: RefundRequestViewModel(paymentId: paymentId))
    }

    var body: some View {
        Form {
            Section("المبلغ") {
                TextField("اتركه فارغاً للاسترداد الكامل", text: $vm.amountMajor)
                    .keyboardType(.decimalPad)
            }
            Section("السبب (اختياري)") {
                TextField("مثال: إلغاء بناءً على سياسة المضيف", text: $vm.reason, axis: .vertical)
                    .lineLimit(2...4)
            }
            if let m = vm.errorMessage {
                Section { Text(m).font(.footnote).foregroundStyle(.red) }
            }
            if let r = vm.result {
                Section("نتيجة الطلب") {
                    LabeledContent("الحالة") { Text(RefundRequestView.label(r.status)) }
                    LabeledContent("المبلغ") { Text(r.amountHalalahs.formatted()).monospacedDigit() }
                    if let ref = r.providerRefundId { LabeledContent("مرجع المزوّد") { Text(ref).font(.caption.monospaced()) } }
                }
            }
            Section {
                Button {
                    Task {
                        await vm.submit()
                        if vm.result != nil { dismiss() }
                    }
                } label: {
                    HStack { if vm.loading { ProgressView() }; Text("طلب الاسترداد") }
                        .frame(maxWidth: .infinity)
                }
                .disabled(vm.loading)
            }
        }
        .navigationTitle("طلب استرداد")
        .navigationBarTitleDisplayMode(.inline)
    }

    static func label(_ s: APIRefundStatus) -> String {
        switch s {
        case .pending:    return "قيد الانتظار"
        case .processing: return "قيد المعالجة"
        case .completed:  return "مكتمل"
        case .failed:     return "فشل"
        case .cancelled:  return "ملغى"
        }
    }
}
