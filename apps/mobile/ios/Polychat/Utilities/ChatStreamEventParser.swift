import Foundation

struct ChatStreamBufferError: LocalizedError {
    let maximumBytes: Int

    var errorDescription: String? {
        "Chat stream event exceeded \(maximumBytes) bytes"
    }
}

enum ChatStreamEventParser {
    static func events(from data: String) throws -> [ChatStreamEvent] {
        guard !data.isEmpty else {
            return []
        }

        if data == "[DONE]" {
            return [.done]
        }

        guard let jsonData = data.data(using: .utf8),
              let object = try JSONSerialization.jsonObject(with: jsonData) as? [String: Any],
              let type = object["type"] as? String else {
            return []
        }

        return try events(forType: type, object: object)
    }

    static func events(fromServerSentEvent event: String) throws -> [ChatStreamEvent] {
        let dataLines = event
            .components(separatedBy: .newlines)
            .compactMap { line -> String? in
                let trimmedLine = line.trimmingCharacters(in: .whitespacesAndNewlines)
                guard trimmedLine.hasPrefix("data:") else {
                    return nil
                }
                return String(trimmedLine.dropFirst(5)).trimmingCharacters(in: .whitespaces)
            }

        guard !dataLines.isEmpty else {
            return []
        }

        return try events(from: dataLines.joined(separator: "\n"))
    }

    private static func events(forType type: String, object: [String: Any]) throws -> [ChatStreamEvent] {
        switch type {
        case "response.error":
            throw APIClientError.streaming(errorMessage(from: object["error"]))
        case "response.created", "response.in_progress", "response.waiting", "response.completed",
             "response.failed", "response.cancelled", "response.incomplete", "response.status_changed":
            guard let response = object["response"],
                  let decoded = JSONObjectDecoding.decode(PlatformResponse.self, from: response) else {
                return []
            }
            return [.response(decoded)]
        case "response.output_text.delta":
            return (object["delta"] as? String).map { [.content($0)] } ?? []
        case "response.reasoning.delta":
            return (object["delta"] as? String).map { [.reasoning($0)] } ?? []
        case "response.output_item.added":
            return outputItemAdded(object["item"] as? [String: Any])
        case "response.output_item.done":
            return outputItemDone(object["item"] as? [String: Any])
        case "response.tool_call.arguments.delta":
            guard let toolCallId = object["call_id"] as? String else {
                return []
            }
            return [.toolUseDelta(
                ChatToolCallEvent(
                    toolCallId: toolCallId,
                    parameters: toolCallParameters(from: object["delta"]),
                    parameterFragment: object["delta"] as? String
                )
            )]
        case "response.content_part.done":
            return [.done]
        case "response.activity":
            return extractTurnActivity(from: object).map { [.turnActivity($0)] } ?? []
        case "response.usage_limits":
            return extractUsageLimits(from: object).map { [.usageLimits($0)] } ?? []
        case "response.phase":
            return (object["phase"] as? String).map { [.state($0)] } ?? []
        case "response.state":
            return (object["state"] as? String).map { [.state($0)] } ?? []
        case "conversation.compacted":
            guard let item = object["item"] as? [String: Any],
                  let message = ConversationItemDecoding.message(from: item) else {
                return []
            }
            return [.compaction(message)]
        case "conversation.title_changed":
            guard let title = (object["title"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !title.isEmpty else {
                return []
            }
            return [.conversationTitle(title)]
        default:
            return []
        }
    }

    private static func errorMessage(from error: Any?) -> String {
        if let message = (error as? [String: Any])?["message"] as? String {
            return message
        }

        return error as? String ?? "Streaming failed"
    }

    private static func outputItemAdded(_ item: [String: Any]?) -> [ChatStreamEvent] {
        guard let item, item["type"] as? String == "tool_call",
              let toolCallId = item["call_id"] as? String else {
            return []
        }

        return [.toolUseStart(ChatToolCallEvent(toolCallId: toolCallId, name: item["name"] as? String ?? "tool"))]
    }

    private static func outputItemDone(_ item: [String: Any]?) -> [ChatStreamEvent] {
        guard let item, let type = item["type"] as? String else {
            return []
        }

        switch type {
        case "tool_call":
            return (item["call_id"] as? String).map { [.toolUseStop($0)] } ?? []
        case "tool_output":
            return extractToolResult(from: item).map { [.toolResult($0)] } ?? []
        case "message":
            return [.metadata(extractStreamMetadata(from: item))]
        default:
            return []
        }
    }

    private static func toolCallParameters(from value: Any?) -> JSONValue? {
        guard let value, !(value is String) else {
            return nil
        }

        return JSONObjectDecoding.decode(JSONValue.self, from: value)
    }

    private static func extractToolResult(from item: [String: Any]) -> ChatToolResultEvent? {
        JSONObjectDecoding.decode(ChatToolResultEvent.self, from: ConversationItemDecoding.messageObject(from: item))
    }

    private static func extractTurnActivity(from object: [String: Any]) -> ChatTurnActivityEvent? {
        guard let kind = object["kind"] as? String else {
            return nil
        }

        if kind == "turn_started" {
            return .turnStarted
        }

        if kind == "turn_finished",
           let rawOutcome = object["outcome"] as? String,
           let outcome = ChatTurnActivityEvent.TurnOutcome(rawValue: rawOutcome) {
            return .turnFinished(outcome: outcome, errorType: object["errorType"] as? String)
        }

        guard let step = object["step"] as? Int, step > 0 else {
            return nil
        }

        switch kind {
        case "model_step_started":
            return .modelStepStarted(step: step)
        case "reasoning_started":
            return .reasoningStarted(step: step)
        case "reasoning_finished":
            return .reasoningFinished(step: step)
        case "response_started":
            return .responseStarted(step: step)
        case "response_finished":
            return .responseFinished(step: step)
        case "model_step_finished":
            guard let rawOutcome = object["outcome"] as? String,
                  let outcome = ChatTurnActivityEvent.StepOutcome(rawValue: rawOutcome) else {
                return nil
            }
            return .modelStepFinished(step: step, outcome: outcome)
        default:
            guard let toolCallId = object["toolCallId"] as? String,
                  let toolName = object["toolName"] as? String else {
                return nil
            }

            switch kind {
            case "tool_input_started":
                return .toolInputStarted(step: step, toolCallId: toolCallId, toolName: toolName)
            case "tool_input_finished":
                return .toolInputFinished(step: step, toolCallId: toolCallId, toolName: toolName)
            case "tool_execution_started":
                return .toolExecutionStarted(step: step, toolCallId: toolCallId, toolName: toolName)
            case "tool_finished":
                guard let rawOutcome = object["outcome"] as? String,
                      let outcome = ChatTurnActivityEvent.ToolOutcome(rawValue: rawOutcome) else {
                    return nil
                }
                return .toolFinished(
                    step: step,
                    toolCallId: toolCallId,
                    toolName: toolName,
                    outcome: outcome
                )
            case "waiting_for_user":
                guard let rawReason = object["reason"] as? String,
                      let reason = ChatTurnActivityEvent.WaitReason(rawValue: rawReason) else {
                    return nil
                }
                return .waitingForUser(
                    step: step,
                    toolCallId: toolCallId,
                    toolName: toolName,
                    reason: reason
                )
            default:
                return nil
            }
        }
    }

    private static func extractUsageLimits(from object: [String: Any]) -> ChatUsageLimits? {
        guard let limits = object["usage_limits"] as? [String: Any] else {
            return nil
        }

        return JSONObjectDecoding.decode(ChatUsageLimits.self, from: limits)
    }

    private static func extractStreamMetadata(from item: [String: Any]) -> ChatStreamMetadata {
        var object = ConversationItemDecoding.messageObject(from: item)
        object["message_id"] = item["id"]
        object["content"] = ConversationItemDecoding.text(from: item["content"])
        let decoded = JSONObjectDecoding.decode(ChatStreamMetadata.self, from: object)

        return ChatStreamMetadata(
            messageId: decoded?.messageId ?? item["id"] as? String,
            content: decoded?.content ?? object["content"] as? String,
            model: decoded?.model ?? object["model"] as? String,
            parts: decoded?.parts,
            reasoning: decoded?.reasoning,
            citations: decoded?.citations,
            data: decoded?.data,
            name: decoded?.name,
            status: decoded?.status,
            logId: decoded?.logId,
            created: decoded?.created
        )
    }
}

struct ChatStreamEventChunkParser {
    static let defaultMaximumEventBytes = 4 * 1024 * 1024

    private var buffer = Data()
    private let maximumEventBytes: Int

    init(maximumEventBytes: Int = Self.defaultMaximumEventBytes) {
        self.maximumEventBytes = maximumEventBytes
    }

    mutating func append(_ data: Data) throws -> [ChatStreamEvent] {
        buffer.append(data)
        let events = try drainCompletedEvents()

        if buffer.count > maximumEventBytes {
            throw ChatStreamBufferError(maximumBytes: maximumEventBytes)
        }

        return events
    }

    mutating func finish() throws -> [ChatStreamEvent] {
        guard !buffer.isEmpty else {
            return []
        }

        let eventData = buffer
        buffer.removeAll(keepingCapacity: true)
        return try ChatStreamEventParser.events(fromServerSentEvent: String(decoding: eventData, as: UTF8.self))
    }

    private mutating func drainCompletedEvents() throws -> [ChatStreamEvent] {
        var events: [ChatStreamEvent] = []

        while let delimiterRange = firstEventDelimiterRange(in: buffer) {
            let eventData = buffer[..<delimiterRange.lowerBound]

            if eventData.count > maximumEventBytes {
                throw ChatStreamBufferError(maximumBytes: maximumEventBytes)
            }

            buffer.removeSubrange(..<delimiterRange.upperBound)
            events.append(
                contentsOf: try ChatStreamEventParser.events(
                    fromServerSentEvent: String(decoding: eventData, as: UTF8.self)
                )
            )
        }

        return events
    }

    private func firstEventDelimiterRange(in data: Data) -> Range<Data.Index>? {
        [
            Data("\r\n\r\n".utf8),
            Data("\n\n".utf8),
            Data("\r\r".utf8)
        ]
        .compactMap { data.range(of: $0) }
        .min { lhs, rhs in lhs.lowerBound < rhs.lowerBound }
    }
}
