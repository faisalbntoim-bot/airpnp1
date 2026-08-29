import SwiftUI

/// Simple check-in / check-out calendar built with SwiftUI (no external dep required).
/// Note: If you want the richer HorizonCalendar experience, add it later —
/// keep this file as the fallback so the app compiles + runs without it.
struct BookingCalendarView: View {
    let property: Property
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState

    @State private var checkIn: Date?
    @State private var checkOut: Date?
    @State private var bookedDays: Set<Date> = []
    @State private var isSaving = false
    @State private var showSuccess = false

    private let cal = Calendar(identifier: .gregorian)

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    header
                    calendar
                    if let n = nights, n > 0 { summary(nights: n) }
                    PrimaryButton(title: "تأكيد الحجز", systemImage: "checkmark.seal.fill") {
                        Task { await confirm() }
                    }
                    .disabled(nights.map { $0 <= 0 } ?? true)
                    .opacity((nights ?? 0) > 0 ? 1 : 0.5)
                }
                .padding(14)
            }
            .background(Theme.bg)
            .navigationTitle("الحجز")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("إلغاء") { dismiss() } }
            }
            .overlay {
                if showSuccess {
                    LottieBookingSuccessView()
                        .padding(24)
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20))
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .task {
                bookedDays = (try? await appState.bookingRepo.availability(for: property.id)) ?? []
            }
        }
    }

    private var header: some View {
        VStack(alignment: .trailing, spacing: 6) {
            Text(property.title).font(Theme.heading(16, weight: .heavy)).foregroundStyle(Theme.ink)
            if let d = property.dailyRateSAR {
                Text("\(Int(d)) ر.س / ليلة").font(.system(size: 12, weight: .heavy))
                    .foregroundStyle(Theme.daily)
            }
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
    }

    private var calendar: some View {
        let today = cal.startOfDay(for: .now)
        let days = (0..<30).compactMap { cal.date(byAdding: .day, value: $0, to: today) }
        let cols = Array(repeating: GridItem(.flexible(), spacing: 6), count: 7)
        return VStack(alignment: .trailing, spacing: 8) {
            SectionHeader(title: "اختر تاريخ الوصول ثم المغادرة")
            LazyVGrid(columns: cols, spacing: 6) {
                ForEach(days, id: \.self) { d in
                    dayCell(d)
                }
            }
        }
        .padding(12)
        .background(Theme.paper, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.line, lineWidth: 1))
    }

    private func dayCell(_ d: Date) -> some View {
        let isBooked = bookedDays.contains(where: { cal.isDate($0, inSameDayAs: d) })
        let isIn = checkIn.map { cal.isDate($0, inSameDayAs: d) } ?? false
        let isOut = checkOut.map { cal.isDate($0, inSameDayAs: d) } ?? false
        let inRange: Bool = {
            guard let ci = checkIn, let co = checkOut else { return false }
            return d > ci && d < co
        }()
        let bg: Color = isBooked ? Theme.line
                      : (isIn || isOut) ? Theme.accent
                      : inRange ? Theme.accent.opacity(0.25)
                      : Theme.bg
        let fg: Color = isBooked ? Theme.textDim
                      : (isIn || isOut) ? .white
                      : Theme.ink
        return Text("\(cal.component(.day, from: d))")
            .font(.system(size: 12, weight: .heavy))
            .frame(width: 34, height: 34)
            .background(bg, in: RoundedRectangle(cornerRadius: 10))
            .foregroundStyle(fg)
            .onTapGesture {
                guard !isBooked else { return }
                onPick(d)
            }
    }

    private func onPick(_ d: Date) {
        if checkIn == nil || (checkIn != nil && checkOut != nil) {
            checkIn = d; checkOut = nil
        } else if let ci = checkIn, d <= ci {
            checkIn = d; checkOut = nil
        } else {
            checkOut = d
        }
    }

    private var nights: Int? {
        guard let ci = checkIn, let co = checkOut else { return nil }
        return cal.dateComponents([.day], from: ci, to: co).day
    }

    private func summary(nights n: Int) -> some View {
        let rate = property.dailyRateSAR ?? 0
        let sub = Double(n) * rate
        let cleaning = 120.0
        let service = (sub * 0.12).rounded()
        let vat = (service * 0.15).rounded()
        let total = sub + cleaning + service + vat
        return VStack(alignment: .trailing, spacing: 6) {
            SectionHeader(title: "الفاتورة")
            row("\(n) ليالٍ × \(Int(rate)) ر.س", value: "\(Int(sub)) ر.س")
            row("تنظيف", value: "\(Int(cleaning)) ر.س")
            row("رسوم خدمة سكن هوب ١٢٪", value: "\(Int(service)) ر.س")
            row("ضريبة القيمة المضافة ١٥٪", value: "\(Int(vat)) ر.س")
            Divider()
            row("الإجمالي", value: "\(Int(total)) ر.س", strong: true)
        }
        .padding(12)
        .background(Theme.paper, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.line, lineWidth: 1))
    }

    private func row(_ label: String, value: String, strong: Bool = false) -> some View {
        HStack {
            Text(value).font(.system(size: strong ? 15 : 12, weight: strong ? .black : .heavy))
                .foregroundStyle(strong ? Theme.accentDeep : Theme.ink)
            Spacer()
            Text(label).font(.system(size: 12, weight: strong ? .heavy : .semibold))
                .foregroundStyle(Theme.textDim)
        }
    }

    private func confirm() async {
        guard let ci = checkIn, let co = checkOut, let n = nights, n > 0 else { return }
        isSaving = true; defer { isSaving = false }
        let rate = property.dailyRateSAR ?? 0
        let sub = Double(n) * rate, cleaning = 120.0, service = sub * 0.12, vat = service * 0.15
        let b = Booking(
            id: UUID().uuidString,
            propertyID: property.id, guestID: MockData.demoUser.id,
            checkIn: ci, checkOut: co, nights: n,
            pricePerNightSAR: rate, cleaningFeeSAR: cleaning,
            serviceFeeSAR: service, vatSAR: vat,
            totalSAR: sub + cleaning + service + vat,
            status: .pending, createdAt: .now
        )
        _ = try? await appState.bookingRepo.create(b)
        withAnimation { showSuccess = true }
        try? await Task.sleep(nanoseconds: 1_600_000_000)
        dismiss()
    }
}
