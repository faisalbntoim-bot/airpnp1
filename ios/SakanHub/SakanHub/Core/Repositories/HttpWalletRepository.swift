import Foundation

/// Wallet + settlements + transactions — all derived on the server from the
/// immutable ledger. iOS never computes running balances locally.
protocol WalletRepository {
    func wallet() async throws -> APIWallet
    func settlements() async throws -> [APISettlement]
}

struct HttpWalletRepository: WalletRepository {
    let client: APIClient
    init(client: APIClient = .shared) { self.client = client }

    func wallet() async throws -> APIWallet {
        try await client.get("/v1/wallet")
    }

    func settlements() async throws -> [APISettlement] {
        try await client.get("/v1/settlements")
    }
}
