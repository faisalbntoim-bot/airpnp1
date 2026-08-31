import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var appState: AppState
    @State private var showAuth: Bool = false

    var body: some View {
        NavigationStack {
            List {
                if let u = appState.currentUser ?? MockData.demoUser as User? {
                    Section {
                        HStack {
                            Circle().fill(Theme.accent).frame(width: 46, height: 46)
                                .overlay(Text(String(u.name.prefix(1))).foregroundStyle(.white).bold())
                            VStack(alignment: .trailing, spacing: 2) {
                                Text(u.name).font(Theme.heading(15, weight: .heavy))
                                Text("\(u.role.rawValue) · \(u.phone)")
                                    .font(.system(size: 12)).foregroundStyle(Theme.textDim)
                            }
                            Spacer()
                        }
                    }
                    Section("حسابي") {
                        NavigationLink("العقارات المحفوظة", destination: SavedView())
                        NavigationLink("الحجوزات", destination: MyBookingsView())
                        NavigationLink("الإشعارات", destination: NotificationListView())
                    }
                    Section("للأعمال") {
                        NavigationLink("لوحة المكتب العقاري", destination: OfficeDashboardView())
                        NavigationLink("لوحة المسوّق", destination: MarketerDashboardView())
                    }
                    Section("الإعدادات") {
                        Toggle("استخدام بيانات تجريبية", isOn: .constant(Config.useMocks)).disabled(true)
                        Text("الإصدار 0.1.0")
                        Button("تسجيل الخروج") { }.foregroundStyle(.red)
                    }
                } else {
                    Section {
                        VStack(spacing: 10) {
                            Text("مرحبًا بك في سكن هوب").font(Theme.heading(16, weight: .heavy))
                            Text("سجّل الدخول لحفظ عقاراتك ومتابعة حجوزاتك.")
                                .font(Theme.body(12)).foregroundStyle(Theme.textDim)
                            PrimaryButton(title: "تسجيل الدخول") { showAuth = true }
                        }.padding()
                    }
                }
            }
            .navigationTitle("حسابي")
            .sheet(isPresented: $showAuth) { AuthView() }
        }
    }
}

struct AuthView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState
    @State private var phone = ""
    @State private var otp = ""
    @State private var stage: Stage = .phone
    @State private var loading = false

    enum Stage { case phone, otp, done }

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                switch stage {
                case .phone:
                    Text("أدخل رقم جوالك").font(Theme.heading(17, weight: .heavy))
                    TextField("+9665XXXXXXXX", text: $phone).keyboardType(.phonePad).textFieldStyle(.roundedBorder)
                    PrimaryButton(title: "إرسال رمز التحقق") { stage = .otp }
                case .otp:
                    Text("أدخل رمز التحقق").font(Theme.heading(17, weight: .heavy))
                    TextField("XXXX", text: $otp).keyboardType(.numberPad).textFieldStyle(.roundedBorder)
                    PrimaryButton(title: "دخول") { Task { await signIn() } }
                        .opacity(loading ? 0.6 : 1)
                case .done:
                    LottieSuccessView(title: "تم تسجيل الدخول")
                }
                Spacer()
            }
            .padding()
            .navigationTitle("تسجيل الدخول")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("إلغاء") { dismiss() } }
            }
        }
    }

    private func signIn() async {
        loading = true; defer { loading = false }
        do {
            let user = try await appState.userRepo.signIn(phone: phone, otp: otp)
            appState.currentUser = user
            appState.isAuthenticated = true
            stage = .done
            try? await Task.sleep(nanoseconds: 900_000_000)
            dismiss()
        } catch {}
    }
}

// Placeholder screens the profile links to — kept minimal so the tree compiles.
struct SavedView: View {
    @EnvironmentObject private var appState: AppState
    @State private var favs: [Property] = []
    @State private var detail: Property?
    var body: some View {
        Group {
            if favs.isEmpty {
                EmptyStateView(icon: "heart", title: "لا توجد عقارات محفوظة بعد",
                               subtitle: "اضغط على ♡ على أي بطاقة لحفظها هنا.")
            } else {
                List(favs) { p in
                    Button { detail = p } label: {
                        VStack(alignment: .trailing, spacing: 4) {
                            Text(p.title).font(Theme.heading(14, weight: .heavy))
                            Text("\(Int(p.priceSAR)) ر.س · \(p.location.neighborhood)")
                                .font(.system(size: 12)).foregroundStyle(Theme.textDim)
                        }
                    }
                }
            }
        }
        .navigationTitle("المحفوظات")
        .sheet(item: $detail) { p in PropertyDetailView(propertyID: p.id) }
        .task {
            let uid = appState.currentUser?.id ?? MockData.demoUser.id
            let list = await appState.favoriteRepo.list(for: uid)
            var out: [Property] = []
            for f in list {
                if let p = try? await appState.propertyRepo.get(id: f.propertyID) { out.append(p) }
            }
            favs = out
        }
    }
}

struct MyBookingsView: View {
    @EnvironmentObject private var appState: AppState
    @State private var bookings: [Booking] = []
    var body: some View {
        Group {
            if bookings.isEmpty {
                EmptyStateView(icon: "calendar", title: "لا توجد حجوزات بعد")
            } else {
                List(bookings) { b in
                    VStack(alignment: .trailing) {
                        Text(b.status.rawValue.capitalized).bold()
                        Text("\(b.nights) ليالٍ · \(Int(b.totalSAR)) ر.س")
                            .font(.system(size: 12)).foregroundStyle(Theme.textDim)
                    }
                }
            }
        }
        .navigationTitle("حجوزاتي")
        .task {
            bookings = (try? await appState.bookingRepo.list(forGuest: MockData.demoUser.id)) ?? []
        }
    }
}
