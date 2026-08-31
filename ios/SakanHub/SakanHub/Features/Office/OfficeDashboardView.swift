import SwiftUI

struct OfficeDashboardView: View {
    @EnvironmentObject private var appState: AppState
    @State private var office: Office?
    @State private var stats: OfficeStats?

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                header
                kpisGrid
                sections
            }
            .padding(14)
        }
        .background(Theme.bg)
        .navigationTitle("لوحة المكتب")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            office = try? await appState.officeRepo.list().first
            if let id = office?.id {
                stats = try? await appState.officeRepo.stats(for: id)
            }
        }
    }

    @ViewBuilder private var header: some View {
        if let o = office {
            HStack(spacing: 10) {
                Circle().fill(Theme.accent).frame(width: 44, height: 44)
                    .overlay(Text(String(o.name.prefix(1))).foregroundStyle(.white).bold())
                VStack(alignment: .trailing, spacing: 3) {
                    Text(o.name).font(Theme.heading(15, weight: .heavy))
                    Text("رخصة \(o.licenseNumber) · \(o.subscription.rawValue)")
                        .font(.system(size: 11)).foregroundStyle(Theme.textDim)
                }
                Spacer()
            }
            .padding(12)
            .background(Theme.paper, in: RoundedRectangle(cornerRadius: 14))
        }
    }

    private var kpisGrid: some View {
        let cols = Array(repeating: GridItem(.flexible(), spacing: 8), count: 2)
        return LazyVGrid(columns: cols, spacing: 8) {
            KPI(icon: "house.fill",         label: "إعلانات نشطة",  value: "\(stats?.activeListings ?? 0)")
            KPI(icon: "eye.fill",           label: "مشاهدات الشهر", value: "\(stats?.monthlyViews ?? 0)")
            KPI(icon: "hand.raised.fill",   label: "طلبات تواصل",   value: "\(stats?.monthlyLeads ?? 0)")
            KPI(icon: "checkmark.seal.fill",label: "صفقات مكتملة",  value: "\(stats?.completedDeals ?? 0)")
        }
    }

    private var sections: some View {
        VStack(spacing: 12) {
            NavigationLink(destination: EmptyStateView(title: "إدارة المسوّقين")) {
                row(icon: "person.3.fill", title: "إدارة المسوّقين")
            }
            NavigationLink(destination: EmptyStateView(title: "الاشتراكات")) {
                row(icon: "creditcard.fill", title: "الاشتراكات")
            }
            NavigationLink(destination: EmptyStateView(title: "الإحصائيات التفصيلية")) {
                row(icon: "chart.bar.fill", title: "الإحصائيات التفصيلية")
            }
        }
    }

    private func row(icon: String, title: String) -> some View {
        HStack {
            Image(systemName: icon).foregroundStyle(Theme.accent)
            Text(title).font(Theme.body(14, weight: .heavy))
            Spacer()
            Image(systemName: "chevron.left").foregroundStyle(Theme.textDim)
        }
        .padding(12).background(Theme.paper, in: RoundedRectangle(cornerRadius: 12))
    }
}

private struct KPI: View {
    let icon: String, label: String, value: String
    var body: some View {
        VStack(alignment: .trailing, spacing: 6) {
            HStack { Image(systemName: icon).foregroundStyle(Theme.accent); Spacer() }
            Text(value).font(Theme.heading(22, weight: .black)).foregroundStyle(Theme.ink)
            Text(label).font(.system(size: 10, weight: .heavy)).foregroundStyle(Theme.textDim)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .trailing)
        .background(Theme.paper, in: RoundedRectangle(cornerRadius: 14))
    }
}
