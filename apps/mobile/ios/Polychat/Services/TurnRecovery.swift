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

struct TurnRecoveryAttemptContext: Equatable {
    let attempt: Int
    let elapsedMs: Int
    let finalAttempt: Bool
    let knownAssistantCount: Int
}

@MainActor
enum TurnRecovery {
    static func recoverDetachedTurn(
        runId initialRunId: String?,
        knownAssistantCount: Int,
        policy: TurnRecoveryPolicy = TurnRecoveryPolicy(),
        resolveCommand: () async throws -> String?,
        fetchRun: (String, TurnRecoveryAttemptContext) async throws -> ChatRunRecoveryResponse,
        onSnapshot: ((ChatRunRecoveryResponse) -> Void)? = nil
    ) async -> ChatRunRecoveryResponse? {
        let clock = ContinuousClock()
        let startedAt = clock.now
        let deadline = startedAt.advanced(by: policy.maxWait)
        var attempt = 0
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

            attempt += 1
            let now = clock.now
            let elapsed = startedAt.duration(to: now).components
            let elapsedMs = Int(elapsed.seconds * 1_000 + elapsed.attoseconds / 1_000_000_000_000_000)
            let context = TurnRecoveryAttemptContext(
                attempt: attempt,
                elapsedMs: max(0, elapsedMs),
                finalAttempt: now.advanced(by: policy.pollInterval) >= deadline,
                knownAssistantCount: knownAssistantCount
            )

            do {
                if runId == nil {
                    runId = try await resolveCommand()
                }

                guard let runId else {
                    continue
                }

                let snapshot = try await fetchRun(runId, context)
                onSnapshot?(snapshot)

                if snapshot.run.isWaiting || snapshot.run.isTerminal {
                    return snapshot
                }
            } catch {
                if context.finalAttempt {
                    break
                }
                continue
            }

            if context.finalAttempt {
                break
            }
        }

        return nil
    }
}
