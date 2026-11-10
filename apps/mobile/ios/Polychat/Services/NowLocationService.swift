import CoreLocation
import Foundation

@MainActor
final class NowLocationService: NSObject, CLLocationManagerDelegate {
    static let shared = NowLocationService()

    private let manager = CLLocationManager()
    private var authorization: CheckedContinuation<CLAuthorizationStatus, Never>?
    private var fix: CheckedContinuation<CLLocation?, Never>?
    var onMove: ((CLLocation) -> Void)?
    var onBackgroundAccess: (() -> Void)?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    var isAuthorized: Bool {
        [.authorizedWhenInUse, .authorizedAlways].contains(manager.authorizationStatus)
    }

    var tracksInBackground: Bool {
        manager.authorizationStatus == .authorizedAlways
    }

    func requestAccess() async -> Bool {
        if manager.authorizationStatus == .notDetermined {
            _ = await withCheckedContinuation { continuation in
                authorization = continuation
                manager.requestAlwaysAuthorization()
            }
        }
        return isAuthorized
    }

    func startMonitoring() {
        guard tracksInBackground else { return }
        manager.startMonitoringSignificantLocationChanges()
        manager.startMonitoringVisits()
    }

    func stopMonitoring() {
        manager.stopMonitoringSignificantLocationChanges()
        manager.stopMonitoringVisits()
    }

    func cachedLocation(maxAge: TimeInterval) -> CLLocation? {
        guard isAuthorized, let location = manager.location,
              -location.timestamp.timeIntervalSinceNow <= maxAge else {
            return nil
        }
        return location
    }

    func currentLocation() async -> CLLocation? {
        guard isAuthorized else { return nil }
        if let pending = fix {
            fix = nil
            pending.resume(returning: nil)
        }
        return await withCheckedContinuation { continuation in
            fix = continuation
            manager.requestLocation()
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            if status == .authorizedAlways { onBackgroundAccess?() }
            guard status != .notDetermined, let continuation = authorization else { return }
            authorization = nil
            continuation.resume(returning: status)
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        Task { @MainActor in
            if let pending = fix {
                fix = nil
                pending.resume(returning: location)
            } else {
                onMove?(location)
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didVisit visit: CLVisit) {
        let location = CLLocation(
            coordinate: visit.coordinate,
            altitude: 0,
            horizontalAccuracy: visit.horizontalAccuracy,
            verticalAccuracy: -1,
            timestamp: visit.departureDate == .distantFuture ? visit.arrivalDate : visit.departureDate
        )
        Task { @MainActor in onMove?(location) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            fix?.resume(returning: nil)
            fix = nil
        }
    }
}
