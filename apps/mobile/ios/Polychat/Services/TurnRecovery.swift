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
        policy: TurnRecoveryPolicy = TurnRecoveryPolicy(),
        fetchMessages: (String) async throws -> [ChatMessage]
    ) async -> [ChatMessage] {
        let clock = ContinuousClock()
        let deadline = clock.now.advanced(by: policy.maxWait)

        while !Task.isCancelled, clock.now < deadline {
            do {
                try await policy.sleep(policy.pollInterval)
            } catch {
                return []
            }

            if Task.isCancelled {
                break
            }

            guard let messages = try? await fetchMessages(completionId) else {
                continue
            }

            let recovered = selectRecoveredMessages(messages, knownMessageIds: knownMessageIds)

            if !recovered.isEmpty {
                return recovered
            }
        }

        return []
    }
}
