import BackgroundTasks
import Foundation

@MainActor
final class HealthSyncController: ObservableObject {
    static let shared = HealthSyncController()
    static let refreshTaskId = "com.polychat-app.app.health-sync"

    private static let enabledKey = "discover.sharesAppleHealth"
    private static let syncedDateKey = "discover.healthSyncedDate"
    private static let summaryKey = "discover.healthLastSummary"

    @Published private(set) var isEnabled = UserDefaults.standard.bool(forKey: HealthSyncController.enabledKey)
    @Published private(set) var lastSummary: DiscoverHealthSummary? = UserDefaults.standard
        .data(forKey: HealthSyncController.summaryKey)
        .flatMap { try? JSONDecoder().decode(DiscoverHealthSummary.self, from: $0) }
    @Published private(set) var isWorking = false
    @Published var error: String?

    private let health = HealthSummaryService.shared
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    var isAvailable: Bool {
        health.isAvailable
    }

    func setEnabled(_ enabled: Bool) async {
        isWorking = true
        defer { isWorking = false }

        do {
            if enabled {
                try await health.requestAccess()
                try await upload()
                scheduleBackgroundRefresh()
            } else {
                try await apiClient.stopSharingDiscoverHealth()
                lastSummary = nil
                UserDefaults.standard.removeObject(forKey: Self.syncedDateKey)
                UserDefaults.standard.removeObject(forKey: Self.summaryKey)
                BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: Self.refreshTaskId)
            }

            isEnabled = enabled
            UserDefaults.standard.set(enabled, forKey: Self.enabledKey)
            error = nil
        } catch {
            self.error = "Apple Health could not be updated: \(error.localizedDescription)"
        }
    }

    func syncIfNeeded() async {
        guard isEnabled, health.isAvailable else {
            return
        }

        scheduleBackgroundRefresh()

        guard UserDefaults.standard.string(forKey: Self.syncedDateKey) != CalendarDate.string(from: Date()) else {
            return
        }

        do {
            try await upload()
            error = nil
        } catch {
            self.error = "Apple Health did not sync: \(error.localizedDescription)"
        }
    }

    func reset() {
        lastSummary = nil
        UserDefaults.standard.removeObject(forKey: Self.syncedDateKey)
        UserDefaults.standard.removeObject(forKey: Self.summaryKey)
    }

    private func upload() async throws {
        let summary = try await health.yesterday()
        try await apiClient.shareDiscoverHealth(summary)
        lastSummary = summary
        UserDefaults.standard.set(try? JSONEncoder().encode(summary), forKey: Self.summaryKey)
        UserDefaults.standard.set(CalendarDate.string(from: Date()), forKey: Self.syncedDateKey)
    }

    private func scheduleBackgroundRefresh() {
        let calendar = Calendar.current
        let earliest = calendar.nextDate(
            after: Date(),
            matching: DateComponents(hour: 5, minute: 30),
            matchingPolicy: .nextTime
        )
        let request = BGAppRefreshTaskRequest(identifier: Self.refreshTaskId)
        request.earliestBeginDate = earliest
        try? BGTaskScheduler.shared.submit(request)
    }
}
