import SwiftUI

/// Minimal wallet screen. All numbers come from the backend
/// (`GET /v1/wallet` + `GET /v1/settlements`). The app never computes a
/// running balance locally.
@MainActor
final class WalletViewModel: ObservableObject {
    @Published var wallet: APIWallet?
    @Published var settlements: [APISettlement] = []
    @Published var loading: Bool = false
    @Published var errorMessage: String?

    private let walletRepo: WalletRepository
    init(walletRepo: WalletRepository = RepositoryFactory.wallet()) { self.walletRepo = walletRepo }

    func reload() async {
        errorMessage = nil
        loading = true
        defer { loading = false }
        do {
            async let w = walletRepo.wallet()
            async let s = walletRepo.settlements()
            self.wallet = try await w
            self.settlements = try await s
        } catch let e as APIError {
            self.errorMessage = e.errorDescription
        } catch {
            self.errorMessage = error.localizedDescription
        }
    }
}

struct WalletView: View {
    @StateObject private var vm = WalletViewModel()

    var body: some View {
        List {
            if let w = vm.wallet {
                Section("رصيدك") {
                    balanceRow("متاح للصرف",       w.availableHalalahs)
                    balanceRow("قيد المعالجة",     w.pendingHalalahs)
                    balanceRow("مدفوع",           w.paidHalalahs)
                    balanceRow("إجمالي الأرباح",  w.totalEarningsHalalahs)
                }
                Section("دفتر الأستاذ") {
                    balanceRow("مستحق كمُضيف",    w.ledger.hostPayable)
                    balanceRow("مستحق كمالك",     w.ledger.ownerPayable)
                    balanceRow("مستحق كمكتب",     w.ledger.officePayable)
                    balanceRow("مستحق كمسوّق",    w.ledger.marketerPayable)
                }
            }
            if !vm.settlements.isEmpty {
                Section("التسويات الأخيرة") {
                    ForEach(vm.settlements.prefix(20), id: \.id) { s in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(Self.statusLabel(s.status)).font(.subheadline)
                                Text(s.id).font(.caption2).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(s.amountHalalahs.formatted(currency: s.currency))
                                .font(.subheadline.monospacedDigit())
                        }
                    }
                }
            }
            if let m = vm.errorMessage {
                Section { Text(m).font(.footnote).foregroundStyle(.red) }
            }
        }
        .navigationTitle("المحفظة")
        .refreshable { await vm.reload() }
        .task { await vm.reload() }
        .overlay { if vm.loading && vm.wallet == nil { ProgressView() } }
    }

    private func balanceRow(_ label: String, _ money: Money) -> some View {
        HStack {
            Text(label)
            Spacer()
            Text(money.formatted()).font(.body.monospacedDigit())
        }
    }

    private static func statusLabel(_ s: APISettlementStatus) -> String {
        switch s {
        case .pending:    return "قيد الانتظار"
        case .eligible:   return "جاهز للصرف"
        case .processing: return "قيد التحويل"
        case .paid:       return "مدفوع"
        case .failed:     return "فشل"
        case .cancelled:  return "ملغى"
        }
    }
}
