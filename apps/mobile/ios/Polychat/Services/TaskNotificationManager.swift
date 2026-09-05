import Combine
import Foundation
import UIKit
import UserNotifications

@MainActor
final class TaskNotificationManager: ObservableObject {
    enum RegistrationState: Equatable {
        case idle
        case awaitingDeviceToken
        case registering
        case registered
        case failed(String)
        case disabled
    }

    @Published private(set) var items: [TaskInboxItem] = []
    @Published private(set) var unread = 0
    @Published private(set) var permission: UNAuthorizationStatus = .notDetermined
    @Published private(set) var registrationState: RegistrationState = .idle
    @Published private(set) var settings: TaskNotificationSettings?
    @Published private(set) var isLoading = false
    @Published var requestedInboxItemId: String?
    @Published var error: String?

    private static let tokenKey = "polychat-notification-device-token"
    private var apiClient: TaskNotificationsAPIClient?
    private var observers: [NSObjectProtocol] = []

    init(notificationCenter: NotificationCenter = .default) {
        observers = [
            notificationCenter.addObserver(
                forName: .taskNotificationDeviceToken,
                object: nil,
                queue: .main
            ) { [weak self] notification in
                guard let token = notification.object as? String else {
                    return
                }

                Task { @MainActor in
                    await self?.receivedDeviceToken(token)
                }
            },
            notificationCenter.addObserver(
                forName: .taskNotificationRegistrationFailed,
                object: nil,
                queue: .main
            ) { [weak self] notification in
                Task { @MainActor in
                    let message = notification.object as? String ?? "Device registration failed"
                    self?.registrationState = .failed(message)
                }
            },
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
            registrationState = .idle
            return
        }

        await refresh()

        guard settings?.preferences.enabled == true else {
            registrationState = .disabled
            return
        }

        await refreshPermission()

        if permission == .authorized || permission == .provisional || permission == .ephemeral {
            if let token = UserDefaults.standard.string(forKey: Self.tokenKey) {
                await register(token: token)
            } else {
                registrationState = .awaitingDeviceToken
                UIApplication.shared.registerForRemoteNotifications()
            }
        }
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
            await refreshPermission()
            reconcileRegistrationState()
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
            let granted = try await UNUserNotificationCenter.current().requestAuthorization(
                options: [.alert, .badge, .sound]
            )
            await refreshPermission()

            guard granted else {
                registrationState = .failed("Notifications are blocked in iOS Settings")
                return
            }

            settings = try await apiClient.updateTaskNotificationPreferences(
                UpdateTaskNotificationPreferencesRequest(enabled: true)
            )

            if let token = UserDefaults.standard.string(forKey: Self.tokenKey) {
                await register(token: token)
            } else {
                registrationState = .awaitingDeviceToken
                UIApplication.shared.registerForRemoteNotifications()
            }
        } catch {
            registrationState = .failed(error.localizedDescription)
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
            _ = try await apiClient.removeTaskNotificationRegistration()
            UIApplication.shared.unregisterForRemoteNotifications()
            UserDefaults.standard.removeObject(forKey: Self.tokenKey)
            registrationState = .disabled
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    func removeRegistrationForLogout() async {
        do {
            _ = try await apiClient?.removeTaskNotificationRegistration()
        } catch {
            self.error = error.localizedDescription
        }

        UIApplication.shared.unregisterForRemoteNotifications()
        UserDefaults.standard.removeObject(forKey: Self.tokenKey)
        registrationState = .idle
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

    private func receivedDeviceToken(_ token: String) async {
        UserDefaults.standard.set(token, forKey: Self.tokenKey)
        await register(token: token)
    }

    private func register(token: String) async {
        guard let apiClient else {
            return
        }

        registrationState = .registering

        do {
            let registration = try await apiClient.registerTaskNotifications(token: token)
            registrationState = registration.state == "registered"
                ? .registered
                : .failed(registration.failureCode ?? "Server registration failed")
            settings = try await apiClient.fetchTaskNotificationSettings()
            error = nil
        } catch {
            registrationState = .failed(error.localizedDescription)
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

    private func refreshPermission() async {
        permission = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
    }

    private func reconcileRegistrationState() {
        guard settings?.preferences.enabled == true else {
            registrationState = .disabled
            return
        }

        if let registration = settings?.registrations.first(where: {
            $0.platform == "ios" && $0.installationId == NotificationInstallation.id
        }) {
            registrationState = registration.state == "registered"
                ? .registered
                : .failed(registration.failureCode ?? "Server registration failed")
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
