import SwiftUI

@main
struct SakanHubApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
                .environment(\.layoutDirection, .rightToLeft)
                .preferredColorScheme(.light)
        }
    }
}
