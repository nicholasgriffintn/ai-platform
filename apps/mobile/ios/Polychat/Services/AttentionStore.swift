import Foundation
import UserNotifications

@MainActor
final class AttentionStore: ObservableObject {
    @Published private(set) var workItems: [WorkAttentionItem] = []
    @Published private(set) var decisions: [WorkInboxItem] = []
    @Published private(set) var places: [WorkPlace] = []
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

    var runItems: [WorkAttentionItem] {
        workItems.filter { $0.type == "run" }
    }

    var visibleBackgroundTasks: [BackgroundTask] {
        backgroundTasks.filter { $0.isActive || $0.status == "failed" }
    }

    func badgeCount(notifications: [TaskInboxItem]) -> Int {
        AttentionPlaces.entries(for: .needsYou, decisions: decisions, runs: runItems, notifications: notifications).count
    }

    func refresh(notifications: [TaskInboxItem]) async {
        isLoading = true
        defer { isLoading = false }

        async let work = loadWork()
        async let tasks = loadBackgroundTasks()
        async let inbox = loadDecisions()
        _ = await (work, tasks, inbox)

        await publish(notifications: notifications)
    }

    func publish(notifications: [TaskInboxItem]) async {
        let needsYou = badgeCount(notifications: notifications)
        let running = workItems.filter(\.isRunning)
        try? await UNUserNotificationCenter.current().setBadgeCount(needsYou)
        WidgetPublisher.publish(attention: actionableItems + running, needsYou: needsYou, running: running.count)
        await liveActivity.sync(live: liveLines, finished: finishedLines)
    }

    private var liveLines: [LiveWorkLine] {
        let blocked = runItems.filter(\.needsAction).map { liveLine($0, state: .needsYou) }
        let running = workItems.filter(\.isRunning).map { liveLine($0, state: .running) }
        return blocked + running
    }

    private var finishedLines: [LiveWorkLine] {
        workItems.compactMap { item in
            switch item.kind {
            case "completed": return liveLine(item, state: .completed)
            case "failed": return liveLine(item, state: .failed)
            default: return nil
            }
        }
    }

    private func liveLine(_ item: WorkAttentionItem, state: LiveWorkLine.State) -> LiveWorkLine {
        LiveWorkLine(
            id: item.resourceId,
            title: item.title,
            place: "\(item.workspaceName) · \(item.projectName)",
            step: item.detail,
            state: state,
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

    var workspaceNames: [String: String] {
        Dictionary(places.map { ($0.id, $0.name) }, uniquingKeysWith: { first, _ in first })
    }

    var projectNames: [String: String] {
        Dictionary(
            places.flatMap { place in place.projects.map { ($0.id, $0.name) } },
            uniquingKeysWith: { first, _ in first }
        )
    }

    private func loadDecisions() async {
        do {
            let inbox = try await apiClient.fetchWorkInbox()
            decisions = inbox.items
            places = inbox.places
        } catch APIClientError.httpStatus(let status, _) where status == 402 || status == 403 {
            decisions = []
        } catch let error where error.isCancellation {
            return
        } catch {
            self.error = "Inbox could not be loaded: \(error.localizedDescription)"
        }
    }

    func reset() async {
        decisions = []
        places = []
        workItems = []
        backgroundTasks = []
        error = nil
        workUnavailable = false
        try? await UNUserNotificationCenter.current().setBadgeCount(0)
        await liveActivity.sync(live: [], finished: [])
    }

    private func loadWork() async {
        do {
            workItems = try await apiClient.fetchWorkAttention(limit: 50).items
            workUnavailable = false
            error = nil
        } catch APIClientError.httpStatus(let status, _) where status == 402 || status == 403 {
            workItems = []
            workUnavailable = true
        } catch let error where error.isCancellation {
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
