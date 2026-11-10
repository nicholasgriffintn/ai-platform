import BackgroundTasks
import Foundation
import UIKit

@MainActor
final class HealthSyncController: ObservableObject {
    static let shared = HealthSyncController()
    static let refreshTaskId = "com.polychat-app.app.health-sync"

    private static let enabledKey = "discover.sharesAppleHealth"
    private static let ownerKey = "discover.healthOwnerUserId"
    private static let syncedDateKey = "discover.healthSyncedDate"
    private static let syncedAtKey = "discover.healthSyncedAt"
    private static let resyncInterval: TimeInterval = 30 * 60
    private static let summaryKey = "discover.healthLastSummary"

    @Published private(set) var isEnabled = HealthSyncController.hasOwnedOptIn()
    @Published private(set) var lastSummary: DiscoverHealthSummary? = UserDefaults.standard
        .data(forKey: HealthSyncController.summaryKey)
        .flatMap { try? JSONDecoder().decode(DiscoverHealthSummary.self, from: $0) }
    @Published private(set) var isWorking = false
    @Published var error: String?

    private let health = HealthSummaryService.shared
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient

        if !isEnabled, UserDefaults.standard.bool(forKey: Self.enabledKey) {
            withdrawOptIn()
        }
    }

    private static func hasOwnedOptIn() -> Bool {
        UserDefaults.standard.bool(forKey: enabledKey)
            && UserDefaults.standard.object(forKey: ownerKey) != nil
    }

    var isAvailable: Bool {
        health.isAvailable
    }

    func setEnabled(_ enabled: Bool, userId: Int?) async {
        guard !enabled || userId != nil else {
            error = "Apple Health can be turned on once your account has loaded."
            return
        }

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
        UserDefaults.standard.removeObject(forKey: Self.syncedAtKey)
                UserDefaults.standard.removeObject(forKey: Self.summaryKey)
                BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: Self.refreshTaskId)
            }

            isEnabled = enabled
            UserDefaults.standard.set(enabled, forKey: Self.enabledKey)
            UserDefaults.standard.set(enabled ? userId : nil, forKey: Self.ownerKey)
            error = nil
        } catch {
            self.error = "Apple Health could not be updated: \(error.localizedDescription)"
        }
    }

    func confirmOwner(userId: Int?) {
        guard isEnabled, let userId,
              UserDefaults.standard.integer(forKey: Self.ownerKey) != userId else {
            return
        }

        reset()
    }

    func syncIfNeeded(client: APIClient? = nil) async {
        guard isEnabled, health.isAvailable else {
            return
        }

        scheduleBackgroundRefresh()

        let syncedAt = Date(timeIntervalSince1970: UserDefaults.standard.double(forKey: Self.syncedAtKey))
        guard UserDefaults.standard.string(forKey: Self.syncedDateKey) != CalendarDate.string(from: Date())
                || Date().timeIntervalSince(syncedAt) >= Self.resyncInterval else {
            return
        }

        if UIApplication.shared.applicationState == .active {
            try? await health.requestAccess()
        }

        do {
            try await upload(client: client ?? apiClient)
            error = nil
        } catch {
            self.error = "Apple Health did not sync: \(error.localizedDescription)"
        }
    }

    func reset() {
        withdrawOptIn()
    }

    private func withdrawOptIn() {
        isEnabled = false
        lastSummary = nil
        UserDefaults.standard.removeObject(forKey: Self.enabledKey)
        UserDefaults.standard.removeObject(forKey: Self.ownerKey)
        UserDefaults.standard.removeObject(forKey: Self.syncedDateKey)
        UserDefaults.standard.removeObject(forKey: Self.syncedAtKey)
        UserDefaults.standard.removeObject(forKey: Self.summaryKey)
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: Self.refreshTaskId)
    }

    private func upload(client: APIClient? = nil) async throws {
        let summary = try await health.summary()
        try await (client ?? apiClient).shareDiscoverHealth(summary)
        lastSummary = summary
        UserDefaults.standard.set(try? JSONEncoder().encode(summary), forKey: Self.summaryKey)
        UserDefaults.standard.set(CalendarDate.string(from: Date()), forKey: Self.syncedDateKey)
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: Self.syncedAtKey)
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
