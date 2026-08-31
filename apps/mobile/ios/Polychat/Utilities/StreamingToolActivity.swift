import Foundation

struct StreamingToolActivity {
    struct Update: Equatable {
        let message: ChatMessage
        let replacingMessageId: String?
    }

    private struct PendingToolCall {
        let toolCallId: String
        var name: String
        var parameters: JSONValue?
    }

    private var pendingToolCalls: [String: PendingToolCall] = [:]
    private var visibleToolCallIds: [String] = []
    private var resolvedMessageIds: Set<String> = []

    var interimMessageIds: [String] {
        visibleToolCallIds.map(Self.toolUseMessageId(forToolCallId:))
    }

    var knownMessageIds: Set<String> {
        resolvedMessageIds
    }

    static func toolUseMessageId(forToolCallId toolCallId: String) -> String {
        "tool-use-\(toolCallId)"
    }

    mutating func start(_ event: ChatToolCallEvent) {
        pendingToolCalls[event.toolCallId] = PendingToolCall(
            toolCallId: event.toolCallId,
            name: event.name ?? "tool",
            parameters: event.parameters
        )
    }

    mutating func applyDelta(_ event: ChatToolCallEvent) {
        guard var pending = pendingToolCalls[event.toolCallId], let parameters = event.parameters else {
            return
        }

        pending.parameters = pending.parameters?.merging(parameters) ?? parameters
        pendingToolCalls[event.toolCallId] = pending
    }

    mutating func stop(toolCallId: String, completionId: String, now: Double = Date().timeIntervalSince1970 * 1000) -> Update? {
        guard let pending = pendingToolCalls.removeValue(forKey: toolCallId) else {
            return nil
        }

        visibleToolCallIds.append(toolCallId)

        return Update(
            message: toolUseMessage(for: pending, completionId: completionId, timestamp: now),
            replacingMessageId: nil
        )
    }

    mutating func resolve(
        _ result: ChatToolResultEvent,
        completionId: String,
        now: Double = Date().timeIntervalSince1970 * 1000
    ) -> Update? {
        let messageId = result.id ?? result.toolCallId.map { "tool-result-\($0)" } ?? UUID().uuidString

        guard !resolvedMessageIds.contains(messageId) else {
            return nil
        }

        resolvedMessageIds.insert(messageId)

        let replacedToolCallId = result.toolCallId.flatMap { toolCallId in
            visibleToolCallIds.contains(toolCallId) ? toolCallId : nil
        }

        if let replacedToolCallId {
            visibleToolCallIds.removeAll { $0 == replacedToolCallId }
        }

        return Update(
            message: toolResultMessage(for: result, id: messageId, completionId: completionId, timestamp: now),
            replacingMessageId: replacedToolCallId.map(Self.toolUseMessageId(forToolCallId:))
        )
    }

    private func toolUseMessage(for pending: PendingToolCall, completionId: String, timestamp: Double) -> ChatMessage {
        let id = Self.toolUseMessageId(forToolCallId: pending.toolCallId)

        return ChatMessage(
            id: id,
            role: "tool",
            content: "",
            parts: [
                ChatMessagePart(
                    id: "\(id)-part",
                    type: "tool_use",
                    name: pending.name,
                    toolCallId: pending.toolCallId,
                    input: pending.parameters,
                    timestamp: timestamp
                )
            ],
            completionId: completionId,
            name: pending.name,
            timestamp: timestamp
        )
    }

    private func toolResultMessage(
        for result: ChatToolResultEvent,
        id: String,
        completionId: String,
        timestamp: Double
    ) -> ChatMessage {
        let resultTimestamp = result.timestamp ?? timestamp

        return ChatMessage(
            id: id,
            role: "tool",
            content: "",
            model: result.model,
            parts: [
                ChatMessagePart(
                    id: "\(id)-part",
                    type: "tool_result",
                    name: result.name,
                    toolCallId: result.toolCallId,
                    status: result.status,
                    content: result.content,
                    timestamp: resultTimestamp
                )
            ],
            data: result.data,
            completionId: completionId,
            name: result.name,
            status: result.status,
            logId: result.logId,
            timestamp: resultTimestamp
        )
    }
}
