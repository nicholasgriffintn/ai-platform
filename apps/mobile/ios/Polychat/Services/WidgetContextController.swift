import CoreLocation
import EventKit
import Foundation
import UIKit

private struct SentLocation: Codable {
    let latitude: Double
    let longitude: Double
    let sentAt: Date
}

@MainActor
final class WidgetContextController: ObservableObject {
    static let shared = WidgetContextController()

    private static let locationKey = "widget.sharesLocation"
    private static let healthKey = "widget.showsHealth"
    private static let sentLocationKey = "widget.sentLocation"
    private static let resendInterval: TimeInterval = 10 * 60
    private static let resendDistance: CLLocationDistance = 300

    @Published private(set) var sharesLocation = UserDefaults.standard.bool(forKey: WidgetContextController.locationKey)
    @Published private(set) var showsHealth = UserDefaults.standard.bool(forKey: WidgetContextController.healthKey)
    @Published private(set) var showsCalendar = WidgetPreferences.showsCalendar
    @Published private(set) var tracksInBackground = false
    @Published private(set) var isWorking = false
    @Published var error: String?

    private let apiClient: APIClient
    private let location = NowLocationService.shared
    private let health = HealthSummaryService.shared

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
        location.onMove = { [weak self] fix in self?.handleMove(fix) }
        location.onBackgroundAccess = { [weak self] in self?.startMonitoring() }
        startMonitoring()
    }

    func activate() {
        startMonitoring()
    }

    var isHealthAvailable: Bool { health.isAvailable }

    func setLocation(_ enabled: Bool) async {
        await working {
            if enabled {
                guard await location.requestAccess() else {
                    error = "Allow location for Polychat in Settings to see nearby lines and weather."
                    return
                }
                sharesLocation = true
                UserDefaults.standard.set(true, forKey: Self.locationKey)
                startMonitoring()
                if let fix = await location.currentLocation() {
                    await shareLocation(fix, force: true, client: apiClient)
                }
            } else {
                sharesLocation = false
                location.stopMonitoring()
                tracksInBackground = false
                UserDefaults.standard.removeObject(forKey: Self.locationKey)
                UserDefaults.standard.removeObject(forKey: Self.sentLocationKey)
                try await apiClient.stopSharingDiscoverLocation()
            }
            error = nil
        }
    }

    func setCalendar(_ enabled: Bool) async {
        await working {
            if enabled {
                guard try await EKEventStore().requestFullAccessToEvents() else {
                    error = "Allow full calendar access for Polychat in Settings to show your next event."
                    return
                }
            }
            showsCalendar = enabled
            WidgetPreferences.showsCalendar = enabled
            WidgetPublisher.reloadCalendar()
            error = nil
        }
    }

    func setHealth(_ enabled: Bool) async {
        await working {
            if enabled {
                try await health.requestVitalsAccess()
                showsHealth = true
                UserDefaults.standard.set(true, forKey: Self.healthKey)
                await publishHealth()
            } else {
                showsHealth = false
                UserDefaults.standard.removeObject(forKey: Self.healthKey)
                WidgetPublisher.publish(health: nil)
            }
            error = nil
        }
    }

    func refresh(background: Bool) async {
        tracksInBackground = sharesLocation && location.tracksInBackground
        if sharesLocation {
            let client = background ? DiscoverBackgroundRefresh.authorizedClient() : apiClient
            let maxAge: TimeInterval = tracksInBackground ? 12 * 60 * 60 : 15 * 60
            let fix = background ? location.cachedLocation(maxAge: maxAge) : await location.currentLocation()
            if let client, let fix {
                await shareLocation(fix, force: false, client: client)
            }
        }
        if showsHealth {
            await publishHealth()
        }
    }

    func reset() {
        location.stopMonitoring()
        tracksInBackground = false
        sharesLocation = false
        showsHealth = false
        showsCalendar = false
        error = nil
        WidgetPreferences.showsCalendar = false
        UserDefaults.standard.removeObject(forKey: Self.locationKey)
        UserDefaults.standard.removeObject(forKey: Self.healthKey)
        UserDefaults.standard.removeObject(forKey: Self.sentLocationKey)
    }

    private func working(_ action: () async throws -> Void) async {
        isWorking = true
        defer { isWorking = false }
        do {
            try await action()
        } catch {
            self.error = "The widget could not be updated: \(error.localizedDescription)"
        }
    }

    private func startMonitoring() {
        guard sharesLocation else { return }
        location.startMonitoring()
        tracksInBackground = location.tracksInBackground
    }

    private func handleMove(_ fix: CLLocation) {
        guard sharesLocation, !isRecentlySent(fix) else { return }
        let task = UIApplication.shared.beginBackgroundTask(withName: "Today widget location")
        Task {
            defer { UIApplication.shared.endBackgroundTask(task) }
            guard let client = DiscoverBackgroundRefresh.authorizedClient(),
                  await shareLocation(fix, force: false, client: client) else { return }
            await DiscoverBackgroundRefresh.publishLatest(using: client)
            if showsHealth { await publishHealth() }
        }
    }

    private func isRecentlySent(_ fix: CLLocation) -> Bool {
        guard let sent = sentLocation() else { return false }
        return -sent.timestamp.timeIntervalSinceNow < Self.resendInterval
            && sent.distance(from: fix) < Self.resendDistance
    }

    @discardableResult
    private func shareLocation(_ fix: CLLocation, force: Bool, client: APIClient) async -> Bool {
        guard force || !isRecentlySent(fix) else { return false }
        do {
            try await client.shareDiscoverLocation(
                DiscoverDeviceLocation(latitude: fix.coordinate.latitude, longitude: fix.coordinate.longitude)
            )
            let sent = SentLocation(latitude: fix.coordinate.latitude, longitude: fix.coordinate.longitude, sentAt: Date())
            UserDefaults.standard.set(try? JSONEncoder().encode(sent), forKey: Self.sentLocationKey)
            return true
        } catch {
            return false
        }
    }

    private func sentLocation() -> CLLocation? {
        guard let data = UserDefaults.standard.data(forKey: Self.sentLocationKey),
              let sent = try? JSONDecoder().decode(SentLocation.self, from: data) else {
            return nil
        }
        return CLLocation(
            coordinate: CLLocationCoordinate2D(latitude: sent.latitude, longitude: sent.longitude),
            altitude: 0,
            horizontalAccuracy: 100,
            verticalAccuracy: -1,
            timestamp: sent.sentAt
        )
    }

    private func publishHealth() async {
        guard health.isAvailable, let vitals = try? await health.vitals() else { return }
        WidgetPublisher.publish(health: vitals)
    }
}
