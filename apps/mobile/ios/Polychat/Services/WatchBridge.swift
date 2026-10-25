import Foundation
import WatchConnectivity

final class WatchBridge: NSObject, WCSessionDelegate {
    static let shared = WatchBridge()

    private var session: WCSession? {
        WCSession.isSupported() ? WCSession.default : nil
    }

    func activate() {
        guard let session else { return }
        session.delegate = self
        session.activate()
    }

    func publish(_ snapshot: WidgetSnapshot) {
        guard let session,
              session.activationState == .activated,
              session.isPaired,
              session.isWatchAppInstalled,
              let data = try? JSONEncoder().encode(snapshot) else {
            return
        }

        try? session.updateApplicationContext([CompanionMessage.snapshot: data])

        if session.isComplicationEnabled, session.remainingComplicationUserInfoTransfers > 0 {
            session.transferCurrentComplicationUserInfo([CompanionMessage.snapshot: data])
        }
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        guard activationState == .activated else { return }
        publish(WidgetSnapshotStore.read())
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
