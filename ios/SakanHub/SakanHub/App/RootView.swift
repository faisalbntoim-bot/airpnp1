import SwiftUI

struct RootView: View {
    @EnvironmentObject var appState: AppState
    @State private var splashDone = false

    var body: some View {
        ZStack {
            if !splashDone {
                LottieSplashView(name: "splash")
                    .transition(.opacity)
                    .onAppear {
                        Task {
                            try? await Task.sleep(nanoseconds: 1_600_000_000)
                            withAnimation { splashDone = true }
                        }
                    }
            } else {
                MainTabView()
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.35), value: splashDone)
    }
}

struct MainTabView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        TabView(selection: $appState.selectedTab) {
            HomeView()
                .tabItem { Label("الرئيسية", systemImage: "play.rectangle.fill") }
                .tag(AppState.Tab.home)

            SearchView()
                .tabItem { Label("البحث", systemImage: "magnifyingglass") }
                .tag(AppState.Tab.search)

            MapExploreView()
                .tabItem { Label("الخريطة", systemImage: "map.fill") }
                .tag(AppState.Tab.map)

            SavedView()
                .tabItem { Label("المحفوظات", systemImage: "heart.fill") }
                .tag(AppState.Tab.saved)

            ProfileView()
                .tabItem { Label("حسابي", systemImage: "person.crop.circle.fill") }
                .tag(AppState.Tab.profile)
        }
        .tint(Theme.accent)
    }
}
