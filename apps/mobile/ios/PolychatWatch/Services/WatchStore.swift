import Combine
import Foundation
import WidgetKit

@MainActor
final class WatchStore: ObservableObject {
    @Published private(set) var snapshot = WidgetSnapshotStore.read()
    @Published private(set) var actionable: [WorkAttentionItem] = []
    @Published private(set) var running: [WorkAttentionItem] = []
    @Published private(set) var agenda: PolyAgenda?
    @Published private(set) var isLoading = false
    @Published private(set) var credentialRejected = false
    @Published var error: String?

    private let apiClient: APIClient
    private var snapshotChanges: AnyCancellable?

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
        snapshotChanges = NotificationCenter.default.publisher(for: .watchSnapshotChanged)
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                self?.snapshot = WidgetSnapshotStore.read()
            }
    }

    static func refreshSnapshot() async {
        await WatchStore().refresh()
    }

    func refresh() async {
        isLoading = true
        defer { isLoading = false }

        do {
            try await apiClient.initialize()
            async let attention = apiClient.fetchWorkAttention(limit: 25)
            async let inbox = apiClient.fetchTaskInbox()
            async let poly = apiClient.fetchPolyAgenda()
            let items = try await attention.items
            let unread = (try? await inbox.unread) ?? 0
            let agenda = try? await poly

            actionable = items.filter(\.needsAction)
            running = items.filter(\.isRunning)
            self.agenda = agenda
            error = nil
            publish(unread: unread)
        } catch APIClientError.httpStatus(401, _) {
            credentialRejected = true
        } catch APIClientError.httpStatus(let status, _) where status == 402 || status == 403 {
            actionable = []
            running = []
        } catch is CancellationError {
            return
        } catch {
            self.error = "Poly could not be reached: \(error.localizedDescription)"
        }
    }

    func removeLocally(_ item: WorkAttentionItem) {
        actionable.removeAll { $0.id == item.id }
    }

    private func publish(unread: Int) {
        let needsYou = actionable.count + unread
        WidgetSnapshotStore.update {
            $0.attention = WidgetSnapshot.Attention(items: actionable + running, needsYou: needsYou, running: running.count)
            $0.poly = agenda.map(WidgetSnapshot.Poly.init(agenda:))
        }
        snapshot = WidgetSnapshotStore.read()
        WidgetCenter.shared.reloadAllTimelines()
    }
}
