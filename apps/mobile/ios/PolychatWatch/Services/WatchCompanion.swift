import Foundation
import WatchConnectivity
import WidgetKit

final class WatchCompanion: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = WatchCompanion()

    @Published private(set) var phoneReachable = false

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func approveOnPhone(userCode: String) async throws {
        let reply: [String: Any] = try await withCheckedThrowingContinuation { continuation in
            WCSession.default.sendMessage(
                [CompanionMessage.signInCode: userCode],
                replyHandler: { continuation.resume(returning: $0) },
                errorHandler: { continuation.resume(throwing: $0) }
            )
        }

        if let message = reply[CompanionMessage.error] as? String {
            throw NotificationActionError.needsApp(message)
        }
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        receive(session.receivedApplicationContext)
        publishReachability(session.isReachable)
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        publishReachability(session.isReachable)
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        receive(applicationContext)
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        receive(userInfo)
    }

    private func receive(_ payload: [String: Any]) {
        guard let data = payload[CompanionMessage.snapshot] as? Data,
              let snapshot = try? JSONDecoder().decode(WidgetSnapshot.self, from: data) else {
            return
        }

        WidgetSnapshotStore.update { $0 = snapshot }
        WidgetCenter.shared.reloadAllTimelines()
        Task { @MainActor in
            NotificationCenter.default.post(name: .watchSnapshotChanged, object: nil)
        }
    }

    private func publishReachability(_ reachable: Bool) {
        Task { @MainActor in
            self.phoneReachable = reachable
        }
    }
}

extension Notification.Name {
    static let watchSnapshotChanged = Notification.Name("watchSnapshotChanged")
}
