import SwiftUI

@MainActor
final class InvoiceDetailViewModel: ObservableObject {
    @Published var invoice: APIInvoice?
    @Published var loading = true
    @Published var errorMessage: String?
    private let repo: InvoiceRepository
    init(repo: InvoiceRepository = RepositoryFactory.invoices()) { self.repo = repo }

    func load(id: String) async {
        errorMessage = nil
        do {
            invoice = try await repo.invoice(id: id)
        } catch let e as APIError {
            errorMessage = e.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }
        loading = false
    }
}

struct InvoiceDetailView: View {
    let invoiceId: String
    @StateObject private var vm = InvoiceDetailViewModel()

    var body: some View {
        Group {
            if let inv = vm.invoice {
                Form {
                    Section("المُصدر") {
                        row("البائع", inv.sellerName)
                        if let vat = inv.sellerVatNumber { row("الرقم الضريبي", vat) }
                    }
                    Section("المُشتري") {
                        row("الاسم", inv.buyerName)
                        if let vat = inv.buyerVatNumber { row("الرقم الضريبي", vat) }
                    }
                    Section("الفاتورة") {
                        row("رقم الفاتورة", inv.invoiceNumber)
                        row("الحالة", inv.status.rawValue)
                        LabeledContent("تاريخ الإصدار") { Text(inv.issueDate, style: .date) }
                    }
                    Section("المبالغ") {
                        money("المبلغ قبل الضريبة", inv.subtotalHalalahs, inv.currency)
                        money("المبلغ الخاضع للضريبة", inv.taxableAmountHalalahs, inv.currency)
                        LabeledContent("نسبة الضريبة") { Text("\(String(format: "%.0f", inv.taxRatePercent))%") }
                        money("الضريبة", inv.taxAmountHalalahs, inv.currency)
                        money("الإجمالي", inv.totalHalalahs, inv.currency)
                            .fontWeight(.semibold)
                    }
                    if inv.xmlRef == nil {
                        Section {
                            Text("لم يتم بعد إصدار توقيع الفاتورة الإلكتروني (ZATCA Fatoora).")
                                .font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                }
            } else if let m = vm.errorMessage {
                ContentUnavailableView(m, systemImage: "exclamationmark.triangle")
            } else if vm.loading {
                ProgressView()
            }
        }
        .navigationTitle("تفاصيل الفاتورة")
        .navigationBarTitleDisplayMode(.inline)
        .task { await vm.load(id: invoiceId) }
    }

    private func row(_ k: String, _ v: String) -> some View {
        LabeledContent(k) { Text(v) }
    }
    private func money(_ k: String, _ v: Money, _ ccy: String) -> some View {
        LabeledContent(k) { Text(v.formatted(currency: ccy)).monospacedDigit() }
    }
}
