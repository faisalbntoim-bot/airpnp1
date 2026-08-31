import Foundation
import SwiftUI

@MainActor
final class HomeViewModel: ObservableObject {
    @Published var properties: [Property] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    /// Currently selected category filter (nil = all).
    @Published var activeCategory: Property.Category?
    @Published var dailyOnly: Bool = false

    private let repo: PropertyRepository

    init(repo: PropertyRepository) {
        self.repo = repo
    }

    func load() async {
        isLoading = true; defer { isLoading = false }
        var f = SearchFilter()
        if let c = activeCategory { f.categories = [c] }
        if dailyOnly { f.purposes = [.daily] }
        do {
            properties = try await repo.list(filter: f, page: 0, pageSize: 30)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
