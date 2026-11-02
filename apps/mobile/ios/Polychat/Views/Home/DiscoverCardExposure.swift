import SwiftUI

struct DiscoverCardExposure: ViewModifier {
    @EnvironmentObject private var store: DiscoverStore
    @Environment(\.scenePhase) private var scenePhase
    @State private var visible = false
    let cardId: String

    func body(content: Content) -> some View {
        let item = store.feedItems.first { $0.card.id == cardId }
        content
            .onScrollVisibilityChange(threshold: 0.6) { visible = $0 }
            .task(id: "\(visible):\(scenePhase == .active):\(item?.revision ?? 0)") {
                guard visible, scenePhase == .active, let item else { return }
                do { try await Task.sleep(for: .seconds(1)); try Task.checkCancellation(); await store.markSeen(item) }
                catch { return }
            }
    }
}
