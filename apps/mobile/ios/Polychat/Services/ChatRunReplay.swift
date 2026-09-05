import Foundation

struct ChatRunReplayState: Equatable {
    var cursor: Int
    var snapshot: ChatRunSnapshotResponse
}

struct ChatRunReplayOutcome: Equatable {
    var state: ChatRunReplayState
    var requiresSnapshot: Bool
    var unsupportedProtocol: Bool
}

enum ChatRunReplay {
    static let protocolVersion = 1

    static func apply(
        state: ChatRunReplayState,
        response: ChatRunReplayResponse
    ) -> ChatRunReplayOutcome {
        guard response.protocolVersion <= protocolVersion else {
            return ChatRunReplayOutcome(
                state: state,
                requiresSnapshot: true,
                unsupportedProtocol: true
            )
        }
        guard response.runId == state.snapshot.run.id, response.fromCursor <= state.cursor else {
            return ChatRunReplayOutcome(
                state: state,
                requiresSnapshot: true,
                unsupportedProtocol: false
            )
        }

        if response.resetRequired {
            guard let snapshot = response.snapshot else {
                return ChatRunReplayOutcome(
                    state: state,
                    requiresSnapshot: true,
                    unsupportedProtocol: false
                )
            }

            return ChatRunReplayOutcome(
                state: ChatRunReplayState(cursor: snapshot.cursor, snapshot: snapshot),
                requiresSnapshot: false,
                unsupportedProtocol: false
            )
        }

        var next = state
        for event in response.events.sorted(by: { $0.sequence < $1.sequence }) {
            if event.sequence <= next.cursor {
                continue
            }
            guard event.sequence == next.cursor + 1,
                  event.runId == next.snapshot.run.id else {
                return ChatRunReplayOutcome(
                    state: state,
                    requiresSnapshot: true,
                    unsupportedProtocol: false
                )
            }
            guard event.protocolVersion <= protocolVersion else {
                return ChatRunReplayOutcome(
                    state: state,
                    requiresSnapshot: true,
                    unsupportedProtocol: true
                )
            }
            guard event.type == "run.accepted"
                    || event.type == "run.status_changed"
                    || event.type == "run.retry_changed" else {
                return ChatRunReplayOutcome(
                    state: state,
                    requiresSnapshot: true,
                    unsupportedProtocol: false
                )
            }
            let updatedRun = event.type == "run.retry_changed"
                ? applyRetry(event: event, to: next.snapshot.run)
                : applyStatus(event: event, to: next.snapshot.run)
            guard let run = updatedRun else {
                return ChatRunReplayOutcome(
                    state: state,
                    requiresSnapshot: true,
                    unsupportedProtocol: false
                )
            }

            next.cursor = event.sequence
            next.snapshot = ChatRunSnapshotResponse(
                protocolVersion: next.snapshot.protocolVersion,
                cursor: event.sequence,
                run: run,
                messages: next.snapshot.messages
            )
        }

        return ChatRunReplayOutcome(
            state: next,
            requiresSnapshot: false,
            unsupportedProtocol: false
        )
    }

    private static func applyStatus(event: ChatRunEvent, to run: ChatRun) -> ChatRun? {
        guard let status = event.data["status"]?.stringValue,
              event.attempt >= run.attempt,
              event.attempt <= run.attempt + 1 else {
            return nil
        }

        if event.attempt == run.attempt && !canTransition(from: run.status, to: status) {
            return run
        }

        let terminal = ["succeeded", "failed", "cancelled", "interrupted"].contains(status)
        return ChatRun(
            protocolVersion: run.protocolVersion,
            id: run.id,
            conversationId: run.conversationId,
            projectId: run.projectId,
            projectTaskId: run.projectTaskId,
            stageId: run.stageId,
            initiatorUserId: run.initiatorUserId,
            status: status,
            attempt: event.attempt,
            createdAt: run.createdAt,
            updatedAt: event.occurredAt,
            startedAt: run.startedAt,
            completedAt: terminal ? event.occurredAt : (status == "running" ? nil : run.completedAt),
            cancellationRequestedAt: run.cancellationRequestedAt,
            terminalReason: event.data["terminalReason"]?.stringValue
                ?? (status == "running" ? nil : run.terminalReason),
            lastMessageId: event.data["lastMessageId"]?.stringValue ?? run.lastMessageId,
            context: event.attempt == run.attempt ? run.context : nil,
            retry: nil,
            usage: event.attempt == run.attempt ? run.usage : nil
        )
    }

    private static func applyRetry(event: ChatRunEvent, to run: ChatRun) -> ChatRun? {
        guard event.attempt == run.attempt,
              !["succeeded", "failed", "cancelled", "interrupted"].contains(run.status),
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

        return ChatRun(
            protocolVersion: run.protocolVersion,
            id: run.id,
            conversationId: run.conversationId,
            projectId: run.projectId,
            projectTaskId: run.projectTaskId,
            stageId: run.stageId,
            initiatorUserId: run.initiatorUserId,
            status: run.status,
            attempt: run.attempt,
            createdAt: run.createdAt,
            updatedAt: event.occurredAt,
            startedAt: run.startedAt,
            completedAt: run.completedAt,
            cancellationRequestedAt: run.cancellationRequestedAt,
            terminalReason: run.terminalReason,
            lastMessageId: run.lastMessageId,
            context: run.context,
            retry: retry,
            usage: run.usage
        )
    }

    private static func canTransition(from: String, to: String) -> Bool {
        if from == to {
            return true
        }

        let transitions: [String: Set<String>] = [
            "accepted": ["running", "cancelling", "failed", "cancelled", "interrupted"],
            "running": ["awaiting_input", "awaiting_approval", "cancelling", "succeeded", "failed", "cancelled", "interrupted"],
            "awaiting_input": ["running", "cancelling", "failed", "cancelled", "interrupted"],
            "awaiting_approval": ["running", "cancelling", "failed", "cancelled", "interrupted"],
            "cancelling": ["cancelled", "failed", "interrupted"]
        ]

        return transitions[from]?.contains(to) == true
    }
}
