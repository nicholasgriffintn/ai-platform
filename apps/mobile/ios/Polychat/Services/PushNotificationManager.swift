import Foundation
import UIKit
import UserNotifications

@MainActor
final class PushNotificationManager: ObservableObject {
    enum RegistrationState: Equatable {
        case idle
        case awaitingDeviceToken
        case registering
        case registered
        case failed(String)
        case disabled
    }

    static let shared = PushNotificationManager()

    @Published var targetToOpen: MobileWorkTarget?
    @Published private(set) var permission: UNAuthorizationStatus = .notDetermined
    @Published private(set) var registrationState: RegistrationState = .idle

    private var apiClient: APIClient?
    private var deviceToken: String?
    private var isRegistered = false

    func configure(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func enableForAuthenticatedUser() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        permission = settings.authorizationStatus
        var authorised = permission == .authorized ||
            settings.authorizationStatus == .provisional

        if settings.authorizationStatus == .notDetermined {
            authorised = (try? await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .badge, .sound])) == true
            permission = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
        }

        if authorised {
            registrationState = deviceToken == nil ? .awaitingDeviceToken : .registering
            UIApplication.shared.registerForRemoteNotifications()
            await registerCurrentToken()
        } else {
            registrationState = .disabled
        }
    }

    func unregisterForSignedOutUser() async {
        guard let deviceToken, isRegistered else {
            return
        }

        try? await apiClient?.unregisterMobilePushDevice(token: deviceToken)
        isRegistered = false
        registrationState = .idle
    }

    func disableForAuthenticatedUser() async {
        if let deviceToken, isRegistered {
            try? await apiClient?.unregisterMobilePushDevice(token: deviceToken)
        }
        UIApplication.shared.unregisterForRemoteNotifications()
        isRegistered = false
        registrationState = .disabled
    }

    func receiveDeviceToken(_ data: Data) async {
        deviceToken = data.map { String(format: "%02x", $0) }.joined()
        registrationState = .registering
        await registerCurrentToken()
    }

    func receiveRegistrationFailure(_ error: Error) {
        isRegistered = false
        registrationState = .failed(error.localizedDescription)
    }

    func receiveNotification(_ userInfo: [AnyHashable: Any]) {
        guard let polychat = userInfo["polychat"] as? [String: Any],
              let target = polychat["target"] as? [String: Any],
              let workspaceId = target["workspaceId"] as? String,
              let projectId = target["projectId"] as? String else {
            return
        }

        targetToOpen = MobileWorkTarget(
            workspaceId: workspaceId,
            projectId: projectId,
            conversationId: target["conversationId"] as? String,
            taskId: target["taskId"] as? String,
            runId: target["runId"] as? String,
            interactionId: target["interactionId"] as? String
        )
    }

    func handleOpenURL(_ url: URL) -> Bool {
        let components = url.pathComponents.filter { $0 != "/" }
        let isWorkURL = (url.scheme == "polychat" && url.host == "work") ||
            (url.host == "polychat.app" && components.first == "work")

        guard isWorkURL else {
            return false
        }

        let path = url.scheme == "polychat" ? components : Array(components.dropFirst())
        guard let workspaceId = value(after: "workspaces", in: path),
              let projectId = value(after: "projects", in: path) else {
            return false
        }

        targetToOpen = MobileWorkTarget(
            workspaceId: workspaceId,
            projectId: projectId,
            conversationId: value(after: "conversations", in: path),
            taskId: value(after: "tasks", in: path),
            runId: value(after: "runs", in: path),
            interactionId: value(after: "interactions", in: path)
        )
        return true
    }

    private func registerCurrentToken() async {
        guard let apiClient, let deviceToken else {
            return
        }

        #if DEBUG
        let environment = "sandbox"
        #else
        let environment = "production"
        #endif

        do {
            try await apiClient.registerMobilePushDevice(
                token: deviceToken,
                environment: environment
            )
            isRegistered = true
            registrationState = .registered
        } catch {
            isRegistered = false
            registrationState = .failed(error.localizedDescription)
        }
    }

    private func value(after marker: String, in components: [String]) -> String? {
        guard let index = components.firstIndex(of: marker), index + 1 < components.count else {
            return nil
        }

        return components[index + 1]
    }
}

final class PolychatAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task { @MainActor in
            await PushNotificationManager.shared.receiveDeviceToken(deviceToken)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        Task { @MainActor in
            PushNotificationManager.shared.receiveRegistrationFailure(error)
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        NotificationCenter.default.post(
            name: .taskNotificationOpened,
            object: response.notification.request.content.userInfo
        )
        await MainActor.run {
            PushNotificationManager.shared.receiveNotification(
                response.notification.request.content.userInfo
            )
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        NotificationCenter.default.post(name: .taskNotificationReceived, object: nil)
        return [.banner, .sound, .badge]
    }
}
