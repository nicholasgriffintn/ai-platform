import Foundation
import UserNotifications

@MainActor
final class AttentionStore: ObservableObject {
    @Published private(set) var workItems: [WorkAttentionItem] = []
    @Published private(set) var decisions: [WorkInboxItem] = []
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
        actionableItems.count + decisions.count + inboxUnread
    }

    func refresh(inboxUnread: Int) async {
        isLoading = true
        defer { isLoading = false }

        async let work = loadWork()
        async let tasks = loadBackgroundTasks()
        async let inbox = loadDecisions()
        _ = await (work, tasks, inbox)

        await publish(inboxUnread: inboxUnread)
    }

    func publish(inboxUnread: Int) async {
        let needsYou = badgeCount(inboxUnread: inboxUnread)
        let running = workItems.filter(\.isRunning).count + backgroundTasks.filter(\.isActive).count
        try? await UNUserNotificationCenter.current().setBadgeCount(needsYou)
        WidgetPublisher.publish(attention: actionableItems + workItems.filter(\.isRunning), needsYou: needsYou, running: running)
        await liveActivity.sync(needsYou: needsYou, workingOn: running, lines: liveLines)
    }

    private var liveLines: [LiveWorkLine] {
        let running = workItems.filter(\.isRunning).map { item in
            liveLine(item, needsYou: false)
        }
        let waiting = actionableItems.map { item in liveLine(item, needsYou: true) }
        let decided = decisions.map { item in
            LiveWorkLine(
                id: item.id,
                title: item.title,
                place: item.workspaceId == nil ? "Personal" : "Work",
                step: item.detail,
                needsYou: true,
                since: AppDateParser.parse(item.since, fallback: Date()),
                link: item.target.flatMap(AppRoute.workLink)
                    ?? item.conversationId.flatMap { URL(string: "polychat://chat/\($0)") }
            )
        }
        return running + waiting + decided
    }

    private func liveLine(_ item: WorkAttentionItem, needsYou: Bool) -> LiveWorkLine {
        LiveWorkLine(
            id: item.id,
            title: item.title,
            place: "\(item.workspaceName) · \(item.projectName)",
            step: item.detail,
            needsYou: needsYou,
            since: AppDateParser.parse(item.occurredAt, fallback: Date()),
            link: AppRoute.workLink(item.target)
        )
    }

    func decideHire(_ item: WorkInboxItem, approve: Bool) async {
        guard let teammateId = item.teammateId, let workspaceId = item.workspaceId else { return }
        do {
            try await apiClient.decideHire(workspaceId: workspaceId, teammateId: teammateId, approve: approve)
            decisions.removeAll { $0.id == item.id }
        } catch {
            self.error = "That hire could not be decided: \(error.localizedDescription)"
        }
    }

    func approveSetup(_ item: WorkInboxItem) async {
        guard let workspaceId = item.workspaceId else { return }
        do {
            try await apiClient.approveCurrentSetupPlan(workspaceId: workspaceId)
            decisions.removeAll { $0.id == item.id }
        } catch {
            self.error = "The setup plan could not be approved: \(error.localizedDescription)"
        }
    }

    func standupDraft(for item: WorkInboxItem) async -> StandupAnswers? {
        guard let projectId = item.projectId, let taskId = item.taskId else { return nil }
        do {
            return try await apiClient.fetchStandupDraft(projectId: projectId, taskId: taskId)
        } catch {
            self.error = "Standup could not be loaded: \(error.localizedDescription)"
            return nil
        }
    }

    func answerStandup(_ item: WorkInboxItem, answers: StandupAnswers) async -> Bool {
        guard let projectId = item.projectId, let taskId = item.taskId else { return false }
        do {
            try await apiClient.answerStandup(projectId: projectId, taskId: taskId, answers: answers)
            decisions.removeAll { $0.id == item.id }
            return true
        } catch {
            self.error = "Your answers could not be sent: \(error.localizedDescription)"
            return false
        }
    }

    private func loadDecisions() async {
        do {
            decisions = try await apiClient.fetchWorkInbox()
        } catch APIClientError.httpStatus(let status, _) where status == 402 || status == 403 {
            decisions = []
        } catch is CancellationError {
            return
        } catch {
            self.error = "Inbox could not be loaded: \(error.localizedDescription)"
        }
    }

    func reset() async {
        decisions = []
        workItems = []
        backgroundTasks = []
        error = nil
        workUnavailable = false
        try? await UNUserNotificationCenter.current().setBadgeCount(0)
        await liveActivity.sync(needsYou: 0, workingOn: 0, lines: [])
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
