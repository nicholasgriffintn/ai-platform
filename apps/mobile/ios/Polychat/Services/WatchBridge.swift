import Foundation
import WatchConnectivity

final class WatchBridge: NSObject, WCSessionDelegate {
    static let shared = WatchBridge()

    static var isSupported: Bool { WCSession.isSupported() }

    private var session: WCSession? {
        WCSession.isSupported() ? WCSession.default : nil
    }

    var isWatchAppInstalled: Bool {
        guard let session, session.activationState == .activated else { return false }
        return session.isPaired && session.isWatchAppInstalled
    }

    func activate() {
        guard let session else { return }
        session.delegate = self
        session.activate()
    }

    func publish(_ snapshot: WidgetSnapshot) {
        guard let session,
              isWatchAppInstalled,
              let data = try? JSONEncoder().encode(snapshot) else {
            return
        }

        updateContext(snapshot: data)

        if session.isComplicationEnabled, session.remainingComplicationUserInfoTransfers > 0 {
            session.transferCurrentComplicationUserInfo([CompanionMessage.snapshot: data])
        }
    }

    func publishPerch() {
        guard isWatchAppInstalled,
              let data = try? JSONEncoder().encode(WidgetSnapshotStore.read()) else {
            return
        }

        updateContext(snapshot: data)
    }

    private func updateContext(snapshot: Data) {
        var context: [String: Any] = [CompanionMessage.snapshot: snapshot]
        if let preferences = try? JSONEncoder().encode(PerchStorage.preferences) {
            context[CompanionMessage.perchPreferences] = preferences
        }
        try? session?.updateApplicationContext(context)
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        guard activationState == .activated else { return }
        publish(WidgetSnapshotStore.read())
        receivePerch(session.receivedApplicationContext)
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        receivePerch(applicationContext)
    }

    private func receivePerch(_ context: [String: Any]) {
        if let data = context[CompanionMessage.perchStats] as? Data,
           let stats = try? JSONDecoder().decode(PerchStats.self, from: data) {
            PerchStorage.stats = stats
        }
        if let data = context[CompanionMessage.perchPreferences] as? Data,
           let preferences = try? JSONDecoder().decode(PerchPreferences.self, from: data) {
            PerchStorage.merge(preferences)
        }

        Task { @MainActor in
            NotificationCenter.default.post(name: .perchChanged, object: nil)
        }
    }

    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }

    func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any],
        replyHandler: @escaping ([String: Any]) -> Void
    ) {
        guard let userCode = message[CompanionMessage.signInCode] as? String else {
            replyHandler([:])
            return
        }

        Task { @MainActor in
            do {
                try await APIClient.shared.initialize()
                _ = try await APIClient.shared.decideDeviceSignIn(userCode: userCode, approve: true)
                replyHandler([CompanionMessage.status: "approved"])
            } catch {
                replyHandler([CompanionMessage.error: "Sign in on your iPhone first, then try again. (\(error.localizedDescription))"])
            }
        }
    }
}
