import SwiftUI

struct MarketerDashboardView: View {
    @EnvironmentObject private var appState: AppState
    @State private var listings: [Property] = []

    var body: some View {
        List {
            Section("عقاراتي المسوّقة") {
                if listings.isEmpty {
                    Text("لا توجد عقارات مصرح لك بتسويقها بعد.").foregroundStyle(Theme.textDim)
                } else {
                    ForEach(listings) { p in
                        VStack(alignment: .trailing, spacing: 3) {
                            Text(p.title).font(Theme.heading(14, weight: .heavy))
                            HStack {
                                Text("مشاهدات \(p.viewsCount)").font(.system(size: 11))
                                Spacer()
                                ShareLink(item: ShareService.shareLink(for: p)) {
                                    Label("مشاركة", systemImage: "square.and.arrow.up")
                                }
                            }
                        }
                    }
                }
            }
            Section("العملاء") {
                Text("لا توجد طلبات جديدة").foregroundStyle(Theme.textDim)
            }
        }
        .navigationTitle("لوحة المسوّق")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            listings = (try? await appState.propertyRepo.list(filter: SearchFilter(), page: 0, pageSize: 6)) ?? []
        }
    }
}
