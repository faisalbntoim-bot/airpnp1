import SwiftUI

@MainActor
final class SearchViewModel: ObservableObject {
    @Published var filter = SearchFilter()
    @Published var results: [Property] = []
    @Published var isLoading = false
    @Published var showFilters = false

    private let repo: PropertyRepository
    private let ai: AIRecommendationService

    init(repo: PropertyRepository, ai: AIRecommendationService = RepositoryFactory.aiRecommendationService()) {
        self.repo = repo; self.ai = ai
    }

    func run() async {
        isLoading = true; defer { isLoading = false }
        do { results = try await repo.list(filter: filter, page: 0, pageSize: 50) }
        catch { results = [] }
    }

    /// Natural-language search: "شقة في شمال الرياض أقل من ٧٠٠ ألف"
    func runNaturalQuery(_ prompt: String) async {
        do {
            let f = try await ai.filterFromNaturalLanguage(prompt)
            filter = f
            await run()
        } catch {}
    }
}

struct SearchView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var vm: SearchViewModel = SearchViewModel(repo: RepositoryFactory.propertyRepository())
    @State private var detailProperty: Property?
    @State private var typedQuery: String = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 8) {
                searchBar
                filterChips
                if vm.isLoading {
                    LoadingView()
                } else if vm.results.isEmpty {
                    EmptyStateView(icon: "magnifyingglass", title: "ابدأ البحث",
                                   subtitle: "اكتب حي، سعر، أو استخدم البحث الذكي.")
                } else {
                    List(vm.results) { p in
                        SearchResultRow(property: p) { detailProperty = p }
                            .listRowInsets(EdgeInsets(top: 6, leading: 12, bottom: 6, trailing: 12))
                            .listRowSeparator(.hidden)
                    }
                    .listStyle(.plain)
                }
            }
            .background(Theme.bg)
            .navigationTitle("البحث")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $vm.showFilters) {
                FilterSheetView(filter: $vm.filter) { Task { await vm.run() } }
                    .presentationDetents([.medium, .large])
            }
            .sheet(item: $detailProperty) { p in PropertyDetailView(propertyID: p.id) }
            .task { await vm.run() }
        }
    }

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "sparkles")
                .foregroundStyle(Theme.accent)
            TextField("ابحث بالحي، السعر، أو صف احتياجك…", text: $typedQuery)
                .textFieldStyle(.plain)
                .submitLabel(.search)
                .onSubmit { Task { await vm.runNaturalQuery(typedQuery) } }
            Button {
                vm.showFilters = true
            } label: {
                Image(systemName: "slider.horizontal.3")
                    .foregroundStyle(Theme.accentDeep)
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(Theme.paper, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.line, lineWidth: 1))
        .padding(.horizontal, 12).padding(.top, 8)
    }

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Property.Category.allCases, id: \.self) { c in
                    Chip(text: c.rawValue, active: vm.filter.categories.contains(c))
                        .onTapGesture {
                            if vm.filter.categories.contains(c) { vm.filter.categories.remove(c) }
                            else { vm.filter.categories.insert(c) }
                            Task { await vm.run() }
                        }
                }
            }
            .padding(.horizontal, 12)
        }
    }
}

private struct SearchResultRow: View {
    let property: Property
    var onTap: () -> Void
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 10) {
                RoundedRectangle(cornerRadius: 12)
                    .fill(LinearGradient(colors: [Theme.accent.opacity(0.35), Theme.accentDeep.opacity(0.6)],
                                         startPoint: .top, endPoint: .bottom))
                    .frame(width: 78, height: 78)
                    .overlay(Image(systemName: "photo").font(.title2).foregroundStyle(.white.opacity(0.65)))
                VStack(alignment: .trailing, spacing: 4) {
                    Text(property.title).font(Theme.heading(14, weight: .heavy)).foregroundStyle(Theme.ink).lineLimit(2)
                    Text("\(Int(property.areaSquareMeters)) م² · \(property.location.neighborhood)")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.textDim)
                    HStack {
                        Text("\(Int(property.priceSAR)) ر.س")
                            .font(Theme.heading(14, weight: .black))
                            .foregroundStyle(Theme.accentDeep)
                        Spacer()
                        Text(property.purpose.rawValue)
                            .font(.system(size: 10, weight: .heavy))
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(Theme.bg2, in: Capsule())
                            .foregroundStyle(Theme.accentDeep)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .trailing)
            }
            .padding(10)
            .background(Theme.paper, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.line, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}
