import Foundation

struct ResponseReplayPolicy {
    var pollInterval: Duration = .seconds(2)
    var sleep: @Sendable (Duration) async throws -> Void = { try await Task.sleep(for: $0) }

    init(
        pollInterval: Duration = .seconds(2),
        sleep: @escaping @Sendable (Duration) async throws -> Void = { try await Task.sleep(for: $0) }
    ) {
        self.pollInterval = pollInterval
        self.sleep = sleep
    }
}

extension PlatformResponse {
    static let terminalStatuses: Set<String> = ["completed", "failed", "cancelled", "incomplete"]

    var isTerminal: Bool {
        Self.terminalStatuses.contains(status)
    }

    var isWaiting: Bool {
        status == "awaiting_input" || status == "awaiting_approval" || status == "awaiting_takeover"
    }

    var isActive: Bool {
        !isTerminal
    }
}

struct ResponseReplayState: Equatable {
    var cursor: Int
    var snapshot: ResponseSnapshot
}

struct ResponseReplayOutcome: Equatable {
    var state: ResponseReplayState
    var requiresSnapshot: Bool
}

enum ResponseReplay {
    static let eventTypes: Set<String> = [
        "response.created",
        "response.status_changed",
        "response.retry_changed"
    ]

    static func reconcile(
        state: ResponseReplayState,
        snapshot: ResponseSnapshot
    ) -> ResponseReplayState {
        guard snapshot.response.id == state.snapshot.response.id,
              snapshot.cursor >= state.cursor else {
            return state
        }

        if state.snapshot.response.isTerminal,
           snapshot.response.status != state.snapshot.response.status {
            return state
        }

        return ResponseReplayState(cursor: snapshot.cursor, snapshot: snapshot)
    }

    static func apply(
        state: ResponseReplayState,
        response replay: ResponseReplayResponse
    ) -> ResponseReplayOutcome {
        guard replay.responseId == state.snapshot.response.id, replay.fromCursor <= state.cursor else {
            return ResponseReplayOutcome(state: state, requiresSnapshot: true)
        }

        if replay.resetRequired {
            guard let snapshot = replay.snapshot else {
                return ResponseReplayOutcome(state: state, requiresSnapshot: true)
            }

            return ResponseReplayOutcome(
                state: reconcile(state: state, snapshot: snapshot),
                requiresSnapshot: false
            )
        }

        var next = state
        let orderedEvents = replay.events
            .filter { $0.sequence > state.cursor }
            .sorted { $0.sequence < $1.sequence }

        for event in orderedEvents {
            if event.sequence <= next.cursor {
                continue
            }
            guard event.sequence == next.cursor + 1,
                  event.responseId == next.snapshot.response.id,
                  eventTypes.contains(event.type) else {
                return ResponseReplayOutcome(state: state, requiresSnapshot: true)
            }

            let updatedResponse = event.type == "response.retry_changed"
                ? applyRetry(event: event, to: next.snapshot.response)
                : applyStatus(event: event, to: next.snapshot.response)
            guard let response = updatedResponse else {
                return ResponseReplayOutcome(state: state, requiresSnapshot: true)
            }

            next.cursor = event.sequence
            next.snapshot = ResponseSnapshot(
                cursor: event.sequence,
                response: response,
                messages: next.snapshot.messages
            )
        }

        return ResponseReplayOutcome(state: next, requiresSnapshot: false)
    }

    private static func applyStatus(event: ResponseEventRecord, to response: PlatformResponse) -> PlatformResponse? {
        guard let status = event.data["status"]?.stringValue,
              event.attempt >= response.attempt,
              event.attempt <= response.attempt + 1 else {
            return nil
        }

        if event.attempt == response.attempt && !canTransition(from: response.status, to: status) {
            return response
        }

        let terminal = PlatformResponse.terminalStatuses.contains(status)
        let sameAttempt = event.attempt == response.attempt

        return PlatformResponse(
            id: response.id,
            conversationId: response.conversationId,
            status: status,
            waitingOn: status.hasPrefix("awaiting_") ? response.waitingOn : nil,
            attempt: event.attempt,
            trigger: response.trigger,
            initiatorUserId: response.initiatorUserId,
            projectId: response.projectId,
            projectTaskId: response.projectTaskId,
            stageId: response.stageId,
            createdAt: response.createdAt,
            updatedAt: event.occurredAt,
            startedAt: response.startedAt,
            completedAt: terminal ? event.occurredAt : (status == "in_progress" ? nil : response.completedAt),
            cancellationRequestedAt: response.cancellationRequestedAt,
            terminalReason: event.data["terminalReason"]?.stringValue
                ?? (status == "in_progress" ? nil : response.terminalReason),
            lastItemId: event.data["lastMessageId"]?.stringValue ?? response.lastItemId,
            context: sameAttempt ? response.context : nil,
            retry: nil,
            provenance: response.provenance,
            usage: sameAttempt ? response.usage : nil,
            receipt: response.receipt,
            output: response.output
        )
    }

    private static func applyRetry(event: ResponseEventRecord, to response: PlatformResponse) -> PlatformResponse? {
        guard event.attempt == response.attempt,
              !response.isTerminal,
              let value = event.data["retry"] else {
            return nil
        }
        let retry: ChatRetrySnapshot?

        if case .null = value {
            retry = nil
        } else {
            guard let data = try? JSONEncoder().encode(value),
                  let decoded = try? JSONDecoder().decode(ChatRetrySnapshot.self, from: data) else {
                return nil
            }
            retry = decoded
        }

        return PlatformResponse(
            id: response.id,
            conversationId: response.conversationId,
            status: response.status,
            waitingOn: response.waitingOn,
            attempt: response.attempt,
            trigger: response.trigger,
            initiatorUserId: response.initiatorUserId,
            projectId: response.projectId,
            projectTaskId: response.projectTaskId,
            stageId: response.stageId,
            createdAt: response.createdAt,
            updatedAt: event.occurredAt,
            startedAt: response.startedAt,
            completedAt: response.completedAt,
            cancellationRequestedAt: response.cancellationRequestedAt,
            terminalReason: response.terminalReason,
            lastItemId: response.lastItemId,
            context: response.context,
            retry: retry,
            provenance: response.provenance,
            usage: response.usage,
            receipt: response.receipt,
            output: response.output
        )
    }

    private static func canTransition(from: String, to: String) -> Bool {
        if from == to {
            return true
        }

        let transitions: [String: Set<String>] = [
            "queued": ["in_progress", "cancelling", "failed", "cancelled", "incomplete"],
            "in_progress": ["awaiting_input", "awaiting_approval", "awaiting_takeover", "cancelling", "completed", "failed", "cancelled", "incomplete"],
            "awaiting_input": ["in_progress", "cancelling", "failed", "cancelled", "incomplete"],
            "awaiting_approval": ["in_progress", "cancelling", "failed", "cancelled", "incomplete"],
            "awaiting_takeover": ["in_progress", "cancelling", "failed", "cancelled", "incomplete"],
            "cancelling": ["cancelled", "failed", "incomplete"]
        ]

        return transitions[from]?.contains(to) == true
    }
}
