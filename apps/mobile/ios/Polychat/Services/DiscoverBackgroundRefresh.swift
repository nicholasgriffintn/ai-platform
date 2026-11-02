import BackgroundTasks
import Foundation

@MainActor
enum DiscoverBackgroundRefresh {
    static let taskId = "com.polychat-app.app.discover-refresh"

    static func schedule() {
        let request = BGAppRefreshTaskRequest(identifier: taskId)
        request.earliestBeginDate = Date().addingTimeInterval(30 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }

    static func run() async {
        guard let token = try? KeychainTokenStore.shared.load(), token.isUsable else { return }
        schedule()
        do {
            let client = APIClient()
            client.setAuthToken(token.value)
            let discover = try await client.fetchDiscover()
            guard !Task.isCancelled else { return }
            guard let current = try? KeychainTokenStore.shared.load(), current.value == token.value else { return }
            if !discover.settings.enabled { cancel() }
            WidgetPublisher.publish(discover: discover)
        } catch {
            return
        }
    }

    static func cancel() {
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: taskId)
    }
}
