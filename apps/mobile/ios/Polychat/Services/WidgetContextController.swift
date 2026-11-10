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
    private static let sentLocationKey = "widget.sentLocation"
    private static let resendInterval: TimeInterval = 10 * 60
    private static let resendDistance: CLLocationDistance = 300

    @Published private(set) var sharesLocation = UserDefaults.standard.bool(forKey: WidgetContextController.locationKey)
    @Published private(set) var syncsCalendar = PhoneActivitySync.syncsCalendar
    @Published private(set) var tracksInBackground = false
    @Published private(set) var isWorking = false
    @Published var error: String?

    private let apiClient: APIClient
    private let location = NowLocationService.shared
    private let eventStore = EKEventStore()
    private var calendarObserver: NSObjectProtocol?

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
        location.onMove = { [weak self] fix in self?.handleMove(fix) }
        location.onBackgroundAccess = { [weak self] in self?.startMonitoring() }
        calendarObserver = NotificationCenter.default.addObserver(
            forName: .EKEventStoreChanged, object: eventStore, queue: .main
        ) { [weak self] _ in
            Task { @MainActor in await self?.calendarChanged() }
        }
        startMonitoring()
    }

    func activate() {
        startMonitoring()
    }

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
                guard try await eventStore.requestFullAccessToEvents() else {
                    error = "Allow full calendar access for Polychat in Settings to sync your calendar."
                    return
                }
            }
            syncsCalendar = enabled
            PhoneActivitySync.syncsCalendar = enabled
            await PhoneActivitySync.sync(client: apiClient, force: true)
            error = nil
        }
    }

    func refresh(background: Bool) async {
        tracksInBackground = sharesLocation && location.tracksInBackground
        guard let client = background ? DiscoverBackgroundRefresh.authorizedClient() : apiClient else { return }
        if sharesLocation {
            let maxAge: TimeInterval = tracksInBackground ? 12 * 60 * 60 : 15 * 60
            let fix = background ? location.cachedLocation(maxAge: maxAge) : await location.currentLocation()
            if let fix {
                await shareLocation(fix, force: false, client: client)
            }
        }
        await PhoneActivitySync.sync(client: client)
        await HealthSyncController.shared.syncIfNeeded(client: client)
    }

    func reset() {
        location.stopMonitoring()
        tracksInBackground = false
        sharesLocation = false
        syncsCalendar = false
        error = nil
        UserDefaults.standard.removeObject(forKey: Self.locationKey)
        UserDefaults.standard.removeObject(forKey: Self.sentLocationKey)
        PhoneActivitySync.reset()
    }

    private func calendarChanged() async {
        guard syncsCalendar else { return }
        await PhoneActivitySync.sync(client: apiClient)
    }

    private func working(_ action: () async throws -> Void) async {
        isWorking = true
        defer { isWorking = false }
        do {
            try await action()
        } catch {
            self.error = "This could not be updated: \(error.localizedDescription)"
        }
    }

    private func startMonitoring() {
        guard sharesLocation else { return }
        location.startMonitoring()
        tracksInBackground = location.tracksInBackground
    }

    private func handleMove(_ fix: CLLocation) {
        guard sharesLocation, !isRecentlySent(fix) else { return }
        let task = UIApplication.shared.beginBackgroundTask(withName: "Polychat location")
        Task {
            defer { UIApplication.shared.endBackgroundTask(task) }
            guard let client = DiscoverBackgroundRefresh.authorizedClient() else { return }
            await PhoneActivitySync.sync(client: client)
            await HealthSyncController.shared.syncIfNeeded(client: client)
            await shareLocation(fix, force: false, client: client)
            await DiscoverBackgroundRefresh.publishLatest(using: client)
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
}
