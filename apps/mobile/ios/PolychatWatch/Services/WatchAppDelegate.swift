import UserNotifications
import WatchKit
import WidgetKit

final class WatchAppDelegate: NSObject, WKApplicationDelegate, UNUserNotificationCenterDelegate {
    private static let refreshInterval: TimeInterval = 30 * 60

    func applicationDidFinishLaunching() {
        UNUserNotificationCenter.current().delegate = self
        NotificationCategories.register()
        WatchCompanion.shared.activate()
        scheduleRefresh()
    }

    func handle(_ backgroundTasks: Set<WKRefreshBackgroundTask>) {
        for task in backgroundTasks {
            guard let refresh = task as? WKApplicationRefreshBackgroundTask else {
                task.setTaskCompletedWithSnapshot(false)
                continue
            }

            Task { @MainActor in
                await WatchStore.refreshSnapshot()
                self.scheduleRefresh()
                refresh.setTaskCompletedWithSnapshot(false)
            }
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        guard NotificationActionHandler.handles(response.actionIdentifier) else { return }
        await NotificationActionHandler.perform(response)
        await WatchStore.refreshSnapshot()
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }

    private func scheduleRefresh() {
        WKApplication.shared().scheduleBackgroundRefresh(
            withPreferredDate: Date().addingTimeInterval(Self.refreshInterval),
            userInfo: nil
        ) { _ in }
    }
}
