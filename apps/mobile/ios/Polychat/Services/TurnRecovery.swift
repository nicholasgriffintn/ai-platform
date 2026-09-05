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

struct TurnRecoveryAttemptContext: Equatable {
    let attempt: Int
    let elapsedMs: Int
    let finalAttempt: Bool
    let knownAssistantCount: Int
}

@MainActor
enum TurnRecovery {
    static func selectRecoveredMessages(
        _ messages: [ChatMessage],
        knownMessageIds: Set<String>
    ) -> [ChatMessage] {
        let recovered = messages.filter { message in
            message.role != "user" && !knownMessageIds.contains(message.id)
        }

        return recovered.contains { $0.role == "assistant" } ? recovered : []
    }

    static func recoverDetachedTurn(
        completionId: String,
        knownMessageIds: Set<String>,
        knownAssistantCount: Int,
        policy: TurnRecoveryPolicy = TurnRecoveryPolicy(),
        fetchMessages: (String, TurnRecoveryAttemptContext) async throws -> [ChatMessage]
    ) async -> [ChatMessage] {
        let clock = ContinuousClock()
        let startedAt = clock.now
        let deadline = startedAt.advanced(by: policy.maxWait)
        var attempt = 0

        while !Task.isCancelled, clock.now < deadline {
            do {
                try await policy.sleep(policy.pollInterval)
            } catch {
                return []
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

            guard let messages = try? await fetchMessages(completionId, context) else {
                continue
            }

            let recovered = selectRecoveredMessages(messages, knownMessageIds: knownMessageIds)

            if !recovered.isEmpty {
                return recovered
            }

            if context.finalAttempt {
                break
            }
        }

        return []
    }
}
