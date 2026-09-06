import Combine
import Foundation

@MainActor
final class TaskNotificationManager: ObservableObject {
    @Published private(set) var items: [TaskInboxItem] = []
    @Published private(set) var unread = 0
    @Published private(set) var settings: TaskNotificationSettings?
    @Published private(set) var isLoading = false
    @Published var requestedInboxItemId: String?
    @Published var error: String?

    private var apiClient: TaskNotificationsAPIClient?
    private var observers: [NSObjectProtocol] = []

    init(notificationCenter: NotificationCenter = .default) {
        observers = [
            notificationCenter.addObserver(
                forName: .taskNotificationReceived,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                Task { @MainActor in
                    await self?.loadInbox()
                }
            },
            notificationCenter.addObserver(
                forName: .taskNotificationOpened,
                object: nil,
                queue: .main
            ) { [weak self] notification in
                Task { @MainActor in
                    self?.handleNotificationPayload(notification.object)
                }
            }
        ]
    }

    deinit {
        observers.forEach(NotificationCenter.default.removeObserver)
    }

    func configure(apiClient: TaskNotificationsAPIClient) {
        self.apiClient = apiClient
    }

    func reconcileAuthenticatedState(isAuthenticated: Bool) async {
        guard isAuthenticated else {
            items = []
            unread = 0
            settings = nil
            requestedInboxItemId = nil
            return
        }

        await refresh()
    }

    func refresh() async {
        guard let apiClient else {
            return
        }

        isLoading = true
        defer { isLoading = false }

        do {
            async let nextSettings = apiClient.fetchTaskNotificationSettings()
            async let inbox = apiClient.fetchTaskInbox()
            settings = try await nextSettings
            let nextInbox = try await inbox
            items = nextInbox.items
            unread = nextInbox.unread
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    func loadInbox() async {
        guard let apiClient else {
            return
        }

        do {
            let inbox = try await apiClient.fetchTaskInbox()
            items = inbox.items
            unread = inbox.unread
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    func enable() async {
        guard let apiClient else {
            return
        }

        do {
            settings = try await apiClient.updateTaskNotificationPreferences(
                UpdateTaskNotificationPreferencesRequest(enabled: true)
            )
        } catch {
            self.error = error.localizedDescription
        }
    }

    func disable() async {
        guard let apiClient else {
            return
        }

        do {
            settings = try await apiClient.updateTaskNotificationPreferences(
                UpdateTaskNotificationPreferencesRequest(enabled: false)
            )
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    func setCategory(_ category: String, enabled: Bool) async {
        guard let apiClient else {
            return
        }

        let request: UpdateTaskNotificationPreferencesRequest

        switch category {
        case "decisions":
            request = .init(decisions: enabled)
        case "failures":
            request = .init(failures: enabled)
        case "completions":
            request = .init(completions: enabled)
        case "assignments":
            request = .init(assignments: enabled)
        default:
            return
        }

        do {
            settings = try await apiClient.updateTaskNotificationPreferences(request)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func markRead(_ item: TaskInboxItem) async {
        await updateReceipt(item, action: "read")
    }

    func dismiss(_ item: TaskInboxItem) async {
        await updateReceipt(item, action: "dismiss")
    }

    func handleDeepLink(_ url: URL) {
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let itemId = components?.queryItems?.first(where: { $0.name == "notification" })?.value

        if let itemId {
            requestedInboxItemId = itemId
        } else if url.path.contains("/tasks/") {
            requestedInboxItemId = items.first(where: { $0.deepLink == url.path })?.id
        }

        if requestedInboxItemId != nil {
            Task { await loadInbox() }
        }
    }

    private func updateReceipt(_ item: TaskInboxItem, action: String) async {
        do {
            _ = try await apiClient?.updateTaskInbox(itemIds: [item.id], action: action)
            await loadInbox()
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func handleNotificationPayload(_ payload: Any?) {
        guard let userInfo = payload as? [AnyHashable: Any] else {
            return
        }

        let data = userInfo["data"] as? [String: Any]
        requestedInboxItemId =
            data?["itemId"] as? String ??
            userInfo["itemId"] as? String
        Task { await loadInbox() }
    }
}
