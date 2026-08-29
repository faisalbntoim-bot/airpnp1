import SwiftUI

/// Apple Guideline 5.1.1(v) + PDPL requirement. The call goes to
/// `DELETE /v1/account`, which anonymises identity, hides properties, and
/// revokes all refresh tokens. Financial records stay intact for audit.
///
/// The user must:
///   1. Confirm the destructive action explicitly (typed word).
///   2. Re-authenticate implicitly via the Bearer token attached to the call.
@MainActor
final class AccountDeletionViewModel: ObservableObject {
    @Published var reason: String = ""
    @Published var confirmationText: String = ""
    @Published var loading: Bool = false
    @Published var errorMessage: String?
    @Published var deleted: Bool = false

    private let auth: AuthRepository
    init(auth: AuthRepository = RepositoryFactory.auth()) { self.auth = auth }

    var canDelete: Bool {
        !loading && confirmationText.trimmingCharacters(in: .whitespaces).uppercased() == "DELETE"
    }

    func delete() async {
        errorMessage = nil
        loading = true
        defer { loading = false }
        do {
            try await auth.deleteAccount(reason: reason.isEmpty ? nil : reason)
            deleted = true
        } catch {
            if case APIError.conflict(let msg) = error {
                errorMessage = msg ?? "لا يمكن الحذف حالياً — لديك عمليات مالية معلّقة"
            } else {
                errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
            }
        }
    }
}

struct AccountDeletionView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var vm = AccountDeletionViewModel()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Form {
            Section {
                Text("حذف الحساب إجراء نهائي.")
                    .foregroundStyle(.red)
                    .font(.headline)
                Text("ستُخفى جميع إعلاناتك، وتُبطَل جلساتك، وتُجهَّل بياناتك الشخصية. تبقى السجلات المالية محفوظة كما يشترط النظام السعودي (فاتورة، دفعات، تسويات) لأغراض المراجعة والالتزام.")
                    .font(.footnote).foregroundStyle(.secondary)
            }

            Section("سبب الحذف (اختياري)") {
                TextField("مثال: لم أعد أستخدم التطبيق", text: $vm.reason, axis: .vertical)
                    .lineLimit(2...4)
            }

            Section("لتأكيد الحذف، اكتب DELETE بأحرف كبيرة") {
                TextField("DELETE", text: $vm.confirmationText)
                    .textInputAutocapitalization(.characters)
                    .disableAutocorrection(true)
            }

            if let m = vm.errorMessage {
                Section { Text(m).foregroundStyle(.red).font(.footnote) }
            }

            Section {
                Button(role: .destructive) {
                    Task {
                        await vm.delete()
                        if vm.deleted {
                            appState.currentUser = nil
                            appState.isAuthenticated = false
                            dismiss()
                        }
                    }
                } label: {
                    HStack {
                        if vm.loading { ProgressView() }
                        Text("احذف حسابي نهائياً")
                    }
                    .frame(maxWidth: .infinity)
                }
                .disabled(!vm.canDelete)
            }
        }
        .navigationTitle("حذف الحساب")
        .navigationBarTitleDisplayMode(.inline)
    }
}
