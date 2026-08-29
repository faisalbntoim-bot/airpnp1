import SwiftUI

@MainActor
final class InvoicesListViewModel: ObservableObject {
    @Published var invoices: [APIInvoice] = []
    @Published var loading = false
    @Published var errorMessage: String?
    private let repo: InvoiceRepository
    init(repo: InvoiceRepository = RepositoryFactory.invoices()) { self.repo = repo }

    func reload() async {
        errorMessage = nil
        loading = true
        defer { loading = false }
        do {
            invoices = try await repo.invoices(page: 1, pageSize: 50, status: nil).items
        } catch let e as APIError {
            errorMessage = e.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct InvoicesView: View {
    @StateObject private var vm = InvoicesListViewModel()

    var body: some View {
        List {
            if vm.invoices.isEmpty && !vm.loading {
                ContentUnavailableView("لا فواتير بعد", systemImage: "doc.text",
                                       description: Text("ستظهر فواتيرك هنا بعد أول عملية دفع مؤكدة."))
            } else {
                ForEach(vm.invoices, id: \.id) { inv in
                    NavigationLink(value: inv.id) {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(inv.invoiceNumber).font(.subheadline.monospaced())
                                Spacer()
                                Text(inv.totalHalalahs.formatted(currency: inv.currency))
                                    .font(.subheadline.monospacedDigit())
                            }
                            HStack {
                                Text(inv.status.rawValue.uppercased()).font(.caption).foregroundStyle(.secondary)
                                Spacer()
                                Text(inv.issueDate, style: .date).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            if let m = vm.errorMessage {
                Section { Text(m).font(.footnote).foregroundStyle(.red) }
            }
        }
        .navigationTitle("الفواتير")
        .navigationDestination(for: String.self) { id in InvoiceDetailView(invoiceId: id) }
        .refreshable { await vm.reload() }
        .task { await vm.reload() }
        .overlay { if vm.loading && vm.invoices.isEmpty { ProgressView() } }
    }
}
