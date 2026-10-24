import Foundation
import UserNotifications

@MainActor
final class AttentionStore: ObservableObject {
    @Published private(set) var workItems: [WorkAttentionItem] = []
    @Published private(set) var backgroundTasks: [BackgroundTask] = []
    @Published private(set) var isLoading = false
    @Published private(set) var workUnavailable = false
    @Published var error: String?

    private let apiClient: APIClient
    private let liveActivity = PolyLiveActivityController()

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    var actionableItems: [WorkAttentionItem] {
        workItems.filter(\.needsAction)
    }

    var otherItems: [WorkAttentionItem] {
        workItems.filter { !$0.needsAction }
    }

    var visibleBackgroundTasks: [BackgroundTask] {
        backgroundTasks.filter { $0.isActive || $0.status == "failed" }
    }

    func badgeCount(inboxUnread: Int) -> Int {
        actionableItems.count + inboxUnread
    }

    func refresh(inboxUnread: Int) async {
        isLoading = true
        defer { isLoading = false }

        async let work = loadWork()
        async let tasks = loadBackgroundTasks()
        _ = await (work, tasks)

        await publish(inboxUnread: inboxUnread)
    }

    func publish(inboxUnread: Int) async {
        let needsYou = badgeCount(inboxUnread: inboxUnread)
        let running = workItems.filter(\.isRunning).count + backgroundTasks.filter(\.isActive).count
        try? await UNUserNotificationCenter.current().setBadgeCount(needsYou)
        WidgetPublisher.publish(attention: actionableItems + workItems.filter(\.isRunning), needsYou: needsYou, running: running)
        await liveActivity.sync(
            needsYou: needsYou,
            workingOn: running,
            headline: (actionableItems.first ?? workItems.first(where: \.isRunning))?.title
        )
    }

    func reset() async {
        workItems = []
        backgroundTasks = []
        error = nil
        workUnavailable = false
        try? await UNUserNotificationCenter.current().setBadgeCount(0)
        await liveActivity.sync(needsYou: 0, workingOn: 0, headline: nil)
    }

    private func loadWork() async {
        do {
            workItems = try await apiClient.fetchWorkAttention(limit: 50).items
            workUnavailable = false
            error = nil
        } catch APIClientError.httpStatus(let status, _) where status == 402 || status == 403 {
            workItems = []
            workUnavailable = true
        } catch is CancellationError {
            return
        } catch {
            self.error = "Attention could not be loaded: \(error.localizedDescription)"
        }
    }

    private func loadBackgroundTasks() async {
        do {
            backgroundTasks = try await apiClient.fetchBackgroundTasks()
        } catch {
            backgroundTasks = []
        }
    }
}
