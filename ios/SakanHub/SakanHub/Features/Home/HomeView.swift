import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var vm: HomeViewModel

    @State private var detailProperty: Property?
    @State private var arProperty: Property?
    @State private var tourProperty: Property?
    @State private var showMap = false
    @State private var shareItem: ShareItem?
    @State private var liked: Set<Property.ID> = []

    init() {
        _vm = StateObject(wrappedValue: HomeViewModel(repo: RepositoryFactory.propertyRepository()))
    }

    var body: some View {
        NavigationStack {
            ZStack(alignment: .top) {
                Theme.bg.ignoresSafeArea()
                content
                topBar
            }
            .task { await vm.load() }
            .sheet(item: $detailProperty) { p in
                PropertyDetailView(propertyID: p.id)
            }
            .fullScreenCover(item: $arProperty) { p in
                ARPropertyView(property: p).ignoresSafeArea()
            }
            .fullScreenCover(item: $tourProperty) { p in
                VirtualTourView(property: p)
            }
            .sheet(isPresented: $showMap) {
                MapExploreView().presentationDetents([.large])
            }
            .sheet(item: $shareItem) { item in
                ShareSheet(text: item.text)
            }
            .navigationBarHidden(true)
        }
    }

    @ViewBuilder private var content: some View {
        if vm.isLoading && vm.properties.isEmpty {
            LoadingView()
        } else if vm.properties.isEmpty {
            EmptyStateView(icon: "sparkles", title: "لا توجد عقارات",
                           subtitle: "غيّر الفلاتر أو حرّك الخريطة لعرض عقارات أخرى.")
        } else {
            ScrollView {
                LazyVStack(spacing: 14) {
                    filterBar
                    ForEach(vm.properties) { p in
                        PropertyCard(
                            property: p,
                            isSaved: false,
                            isLiked: liked.contains(p.id),
                            onLike:       { toggleLike(p) },
                            onSave:       { Task { await save(p) } },
                            onShare:      { shareItem = .init(text: ShareService.shareText(for: p)) },
                            onOpenDetail: { detailProperty = p },
                            onOpenMap:    { showMap = true },
                            onOpenAR:     { arProperty = p },
                            onOpenTour:   { tourProperty = p }
                        )
                        .frame(height: 560)
                        .padding(.horizontal, 12)
                    }
                }
                .padding(.top, 90).padding(.bottom, 24)
            }
            .refreshable { await vm.load() }
        }
    }

    private var topBar: some View {
        HStack(spacing: 10) {
            Text("سكن هوب")
                .font(Theme.heading(19, weight: .black))
                .foregroundStyle(Theme.accentDeep)
            Text("· الرياض")
                .font(.system(size: 12, weight: .heavy))
                .foregroundStyle(Theme.textDim)
            Spacer()
            YearlyDailyToggle(isDaily: $vm.dailyOnly)
                .onChange(of: vm.dailyOnly) { _, _ in Task { await vm.load() } }
        }
        .padding(.horizontal, 16).padding(.vertical, 10)
        .background(.thinMaterial)
    }

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                Chip(text: "الكل", systemImage: "square.grid.2x2", active: vm.activeCategory == nil)
                    .onTapGesture { vm.activeCategory = nil; Task { await vm.load() } }
                ForEach(Property.Category.allCases, id: \.self) { c in
                    Chip(text: c.rawValue, active: vm.activeCategory == c)
                        .onTapGesture { vm.activeCategory = (vm.activeCategory == c) ? nil : c; Task { await vm.load() } }
                }
            }
            .padding(.horizontal, 12)
        }
    }

    private func toggleLike(_ p: Property) {
        if liked.contains(p.id) { liked.remove(p.id) } else { liked.insert(p.id) }
    }

    private func save(_ p: Property) async {
        let uid = appState.currentUser?.id ?? MockData.demoUser.id
        _ = await appState.favoriteRepo.toggle(propertyID: p.id, userID: uid)
    }
}

// MARK: - Yearly ⇄ Daily toggle

private struct YearlyDailyToggle: View {
    @Binding var isDaily: Bool
    var body: some View {
        HStack(spacing: 0) {
            segment(text: "سنوي", active: !isDaily) { isDaily = false }
            segment(text: "يومي", active: isDaily)  { isDaily = true }
        }
        .padding(3)
        .background(isDaily ? Color(hex: 0xFFD37A).opacity(0.35) : Theme.bg2, in: Capsule())
        .overlay(Capsule().stroke(Theme.line, lineWidth: 1))
    }
    private func segment(text: String, active: Bool, tap: @escaping () -> Void) -> some View {
        Text(text)
            .font(.system(size: 12, weight: .heavy))
            .foregroundStyle(active ? .black : Theme.textDim)
            .padding(.horizontal, 12).padding(.vertical, 6)
            .background(active ? Color.white : Color.clear, in: Capsule())
            .onTapGesture(perform: tap)
    }
}

// MARK: - Share sheet

struct ShareItem: Identifiable {
    let id = UUID()
    let text: String
}

struct ShareSheet: UIViewControllerRepresentable {
    let text: String
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [text], applicationActivities: nil)
    }
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
