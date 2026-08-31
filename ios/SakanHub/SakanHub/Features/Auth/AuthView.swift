import SwiftUI

/// Two-step OTP flow. Phone → OTP request → verify → JWT stored in Keychain
/// and the user is dropped into the app. No PSP secrets, no local password.
@MainActor
final class AuthViewModel: ObservableObject {
    enum Step { case phone, code }

    @Published var step: Step = .phone
    @Published var phone: String = "+9665"
    @Published var code: String = ""
    @Published var displayName: String = ""
    @Published var loading: Bool = false
    @Published var errorMessage: String?

    private var requestId: String?
    private let auth: AuthRepository

    init(auth: AuthRepository = RepositoryFactory.auth()) { self.auth = auth }

    func requestCode() async {
        errorMessage = nil
        guard phone.hasPrefix("+"), phone.count >= 10 else {
            errorMessage = "أدخل رقم هاتف صحيح بصيغة E.164"
            return
        }
        loading = true
        defer { loading = false }
        do {
            let r = try await auth.requestOtp(phone: phone)
            requestId = r.requestId
            step = .code
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    /// Returns the newly authenticated user on success (nil on failure — UI reads `errorMessage`).
    func verifyCode() async -> APIUser? {
        errorMessage = nil
        guard let requestId else { errorMessage = "أعد طلب الرمز"; return nil }
        guard code.count == 6, code.allSatisfy(\.isNumber) else {
            errorMessage = "الرمز يتكون من 6 أرقام"
            return nil
        }
        loading = true
        defer { loading = false }
        do {
            let result = try await auth.verifyOtp(requestId: requestId, phone: phone, code: code,
                                                  nameAr: displayName.isEmpty ? nil : displayName)
            return result.user
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
            return nil
        }
    }
}

struct AuthView: View {
    @StateObject private var vm = AuthViewModel()
    @EnvironmentObject private var appState: AppState

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer(minLength: 24)
                Image(systemName: "house.circle.fill")
                    .font(.system(size: 72))
                    .foregroundStyle(.tint)
                Text("سكن هوب")
                    .font(.system(.largeTitle, design: .rounded).weight(.bold))
                Text("سجّل الدخول برقم جوّالك")
                    .foregroundStyle(.secondary)

                Group {
                    switch vm.step {
                    case .phone: phoneStep
                    case .code:  codeStep
                    }
                }

                if let m = vm.errorMessage {
                    Text(m).foregroundStyle(.red).font(.footnote).multilineTextAlignment(.center)
                }
                Spacer()
            }
            .padding(24)
        }
    }

    private var phoneStep: some View {
        VStack(spacing: 12) {
            TextField("+9665XXXXXXXX", text: $vm.phone)
                .textFieldStyle(.roundedBorder)
                .keyboardType(.phonePad)
                .textContentType(.telephoneNumber)
                .disableAutocorrection(true)
            TextField("الاسم (اختياري)", text: $vm.displayName)
                .textFieldStyle(.roundedBorder)
            Button {
                Task { await vm.requestCode() }
            } label: {
                if vm.loading { ProgressView() }
                else { Text("أرسل رمز التحقق").bold() }
            }
            .buttonStyle(.borderedProminent)
            .disabled(vm.loading)
        }
    }

    private var codeStep: some View {
        VStack(spacing: 12) {
            Text("أدخل الرمز المرسل إلى \(vm.phone)")
                .font(.footnote).foregroundStyle(.secondary)
            TextField("رمز 6 أرقام", text: $vm.code)
                .textFieldStyle(.roundedBorder)
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode)
            Button {
                Task {
                    if let apiUser = await vm.verifyCode() {
                        appState.currentUser = HttpAuthUserAdapter.toDomain(apiUser)
                        appState.isAuthenticated = true
                    }
                }
            } label: {
                if vm.loading { ProgressView() }
                else { Text("تحقق").bold() }
            }
            .buttonStyle(.borderedProminent)
            .disabled(vm.loading)

            Button("تغيير رقم الجوّال") { vm.step = .phone; vm.code = "" }
                .font(.footnote)
        }
    }
}
