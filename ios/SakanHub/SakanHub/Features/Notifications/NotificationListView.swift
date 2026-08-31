import SwiftUI

struct NotificationListView: View {
    @EnvironmentObject private var appState: AppState
    @State private var items: [AppNotification] = []

    var body: some View {
        List(items) { n in
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: icon(for: n.kind))
                    .frame(width: 34, height: 34)
                    .background(Theme.bg2, in: Circle())
                    .foregroundStyle(Theme.accent)
                VStack(alignment: .trailing, spacing: 3) {
                    Text(n.title).font(Theme.heading(13, weight: .heavy)).foregroundStyle(Theme.ink)
                    Text(n.body).font(Theme.body(12)).foregroundStyle(Theme.textDim)
                    Text(n.createdAt.formatted(.relative(presentation: .named)))
                        .font(.system(size: 10)).foregroundStyle(Theme.textDim.opacity(0.7))
                }
                Spacer()
                if !n.isRead {
                    Circle().fill(Theme.accent).frame(width: 8, height: 8)
                }
            }
            .padding(.vertical, 4)
        }
        .navigationTitle("الإشعارات")
        .task {
            items = (try? await appState.notificationRepo.list(for: MockData.demoUser.id)) ?? []
        }
    }

    private func icon(for k: AppNotification.Kind) -> String {
        switch k {
        case .saved: "bookmark.fill"
        case .bookingConfirmed: "calendar.badge.checkmark"
        case .bookingRejected: "calendar.badge.exclamationmark"
        case .viewingRequest: "eye.fill"
        case .priceChanged: "arrow.up.right.circle"
        case .backAvailable: "checkmark.circle.fill"
        case .newMatch: "sparkles"
        case .message: "message.fill"
        case .system: "gearshape.fill"
        }
    }
}
