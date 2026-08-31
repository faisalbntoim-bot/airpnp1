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

    /// Server-computed quote. All money numbers on this screen come from here —
    /// there is no local fee, VAT, or total calculation. See docs/API_CONTRACT.md.
    @State private var quote: APIQuote?
    @State private var quoteError: String?

    private let cal = Calendar(identifier: .gregorian)
    private let http = HttpBookingRepository()

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
        VStack(alignment: .trailing, spacing: 6) {
            SectionHeader(title: "الفاتورة")
            if let q = quote {
                // Every value below comes verbatim from the backend engine.
                row("\(n) ليالٍ", value: q.grossAmountHalalahs.formatted(currency: q.currency))
                row("رسوم منصة سكن هوب", value: q.commission.platformFeeHalalahs.formatted(currency: q.currency))
                if q.taxOnPlatformFee.taxAmountHalalahs.halalahs != "0" {
                    row("ضريبة على الرسوم (\(Int(q.taxOnPlatformFee.ratePercent))٪)",
                        value: q.taxOnPlatformFee.taxAmountHalalahs.formatted(currency: q.currency))
                }
                if q.taxOnRental.taxAmountHalalahs.halalahs != "0" {
                    row("ضريبة على الإيجار (\(Int(q.taxOnRental.ratePercent))٪)",
                        value: q.taxOnRental.taxAmountHalalahs.formatted(currency: q.currency))
                }
                Divider()
                row("الإجمالي", value: q.customerTotalHalalahs.formatted(currency: q.currency), strong: true)
            } else if let m = quoteError {
                Text(m).font(.footnote).foregroundStyle(.red)
            } else {
                HStack { Spacer(); ProgressView().padding(.vertical, 8); Spacer() }
                Text("يتم حساب السعر النهائي من الخادم…")
                    .font(.footnote).foregroundStyle(Theme.textDim)
            }
        }
        .padding(12)
        .background(Theme.paper, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.line, lineWidth: 1))
        .task(id: n) { await refreshQuote(nights: n) }
    }

    private func refreshQuote(nights n: Int) async {
        let rate = property.dailyRateSAR ?? 0
        let subMajor = Double(n) * rate
        guard subMajor > 0 else { quote = nil; return }
        do {
            quoteError = nil
            quote = try await http.quote(input: .init(
                transactionType: "DAILY_RENTAL",
                propertyType: propertyTypeKey(),
                grossAmount: String(Int(subMajor.rounded())),
                currency: "SAR"
            ))
        } catch let e as APIError {
            quoteError = e.errorDescription
        } catch {
            quoteError = error.localizedDescription
        }
    }

    private func propertyTypeKey() -> String {
        switch property.category {
        case .apartment: return "apartment"; case .villa: return "villa"
        case .duplex: return "duplex"; case .studio: return "studio"
        case .land: return "land"; case .office: return "office"
        case .shop: return "shop"; case .farm: return "farm"
        case .commercial: return "commercial"; case .building: return "building"
        }
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
        let subMajor = Double(n) * rate
        do {
            // The backend is authoritative: it recomputes the quote, enforces
            // availability, and stores the confirmed booking + its immutable quote.
            _ = try await http.createBooking(
                .init(
                    propertyId: property.id,
                    transactionType: "DAILY_RENTAL",
                    grossAmount: String(Int(subMajor.rounded())),
                    currency: "SAR",
                    nights: n,
                    checkIn:  ISO8601DateFormatter().string(from: ci),
                    checkOut: ISO8601DateFormatter().string(from: co)
                ),
                idempotencyKey: UUID().uuidString
            )
            withAnimation { showSuccess = true }
            try? await Task.sleep(nanoseconds: 1_600_000_000)
            dismiss()
        } catch let e as APIError {
            quoteError = e.errorDescription
        } catch {
            quoteError = error.localizedDescription
        }
    }
}
