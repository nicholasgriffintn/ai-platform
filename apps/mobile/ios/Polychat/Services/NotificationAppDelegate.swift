import UIKit
import UserNotifications

extension Notification.Name {
    static let taskNotificationDeviceToken = Notification.Name("taskNotificationDeviceToken")
    static let taskNotificationRegistrationFailed = Notification.Name("taskNotificationRegistrationFailed")
    static let taskNotificationOpened = Notification.Name("taskNotificationOpened")
    static let taskNotificationReceived = Notification.Name("taskNotificationReceived")
}

final class NotificationAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
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
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        NotificationCenter.default.post(name: .taskNotificationDeviceToken, object: token)
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        NotificationCenter.default.post(
            name: .taskNotificationRegistrationFailed,
            object: error.localizedDescription
        )
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        NotificationCenter.default.post(name: .taskNotificationReceived, object: nil)
        return [.banner, .sound, .badge]
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        NotificationCenter.default.post(
            name: .taskNotificationOpened,
            object: response.notification.request.content.userInfo
        )
    }
}
