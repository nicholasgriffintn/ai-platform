import Foundation

struct TurnRecoveryPolicy {
    var pollInterval: Duration = .seconds(2)
    var maxWait: Duration = .seconds(180)
    var sleep: @Sendable (Duration) async throws -> Void = { try await Task.sleep(for: $0) }

    init(
        pollInterval: Duration = .seconds(2),
        maxWait: Duration = .seconds(180),
        sleep: @escaping @Sendable (Duration) async throws -> Void = { try await Task.sleep(for: $0) }
    ) {
        self.pollInterval = pollInterval
        self.maxWait = maxWait
        self.sleep = sleep
    }
}

enum TurnRecoveryStatus {
    static let reconnecting = "Reconnecting to the response…"
    static let reconnectingNotice = "\n\n_Reconnecting to the response…_"
}

extension ChatRun {
    var isTerminal: Bool {
        ["succeeded", "failed", "cancelled", "interrupted"].contains(status)
    }

    var isWaiting: Bool {
        status == "awaiting_input" || status == "awaiting_approval"
    }

    var isActive: Bool {
        !isTerminal
    }
}

@MainActor
enum TurnRecovery {
    static func recoverDetachedTurn(
        runId initialRunId: String?,
        policy: TurnRecoveryPolicy = TurnRecoveryPolicy(),
        resolveCommand: () async throws -> String?,
        fetchRun: (String) async throws -> ChatRunRecoveryResponse,
        onSnapshot: ((ChatRunRecoveryResponse) -> Void)? = nil
    ) async -> ChatRunRecoveryResponse? {
        let clock = ContinuousClock()
        let deadline = clock.now.advanced(by: policy.maxWait)
        var runId = initialRunId

        while !Task.isCancelled, clock.now < deadline {
            do {
                try await policy.sleep(policy.pollInterval)
            } catch {
                return nil
            }

            if Task.isCancelled {
                break
            }

            do {
                if runId == nil {
                    runId = try await resolveCommand()
                }

                guard let runId else {
                    continue
                }

                let snapshot = try await fetchRun(runId)
                onSnapshot?(snapshot)

                if snapshot.run.isWaiting || snapshot.run.isTerminal {
                    return snapshot
                }
            } catch {
                continue
            }
        }

        return nil
    }
}
