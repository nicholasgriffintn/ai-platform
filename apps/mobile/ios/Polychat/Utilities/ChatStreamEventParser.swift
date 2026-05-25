import Foundation

enum ChatStreamEventParser {
    static func events(from data: String) throws -> [ChatStreamEvent] {
        guard !data.isEmpty else {
            return []
        }

        if data == "[DONE]" {
            return [.done]
        }

        guard let jsonData = data.data(using: .utf8),
              let object = try JSONSerialization.jsonObject(with: jsonData) as? [String: Any] else {
            return []
        }

        if let type = object["type"] as? String {
            return try events(forType: type, object: object)
        }

        if let content = extractContentDelta(from: object) {
            return [.content(content)]
        }

        if let choices = object["choices"] as? [[String: Any]],
           let delta = choices.first?["delta"] as? [String: Any],
           let content = delta["content"] as? String {
            return [.content(content)]
        }

        return []
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
        case "error":
            let message = ((object["error"] as? [String: Any])?["message"] as? String) ??
                (object["error"] as? String) ??
                "Streaming failed"
            throw APIClientError.streaming(message)
        case "content_block_delta", "response.output_text.delta":
            return extractContentDelta(from: object).map { [.content($0)] } ?? []
        case "thinking_delta":
            return extractReasoningDelta(from: object).map { [.reasoning($0)] } ?? []
        case "signature_delta", "content_block_start", "content_block_stop", "message_start":
            return []
        case "tool_use_start":
            return [.state("tool_use_start")]
        case "tool_use_stop":
            return [.state("tool_use_stop")]
        case "tool_response", "tool_response_start", "tool_response_end", "tool_use_delta":
            return []
        case "state":
            return (object["state"] as? String).map { [.state($0)] } ?? []
        case "message_stop":
            return [.done]
        case "message_delta":
            return [.metadata(extractStreamMetadata(from: object)), .done]
        default:
            return []
        }
    }

    private static func extractContentDelta(from object: [String: Any]) -> String? {
        if let content = object["content"] as? String {
            return content
        }

        if let delta = object["delta"] as? String {
            return delta
        }

        if let response = object["response"] as? String {
            return response
        }

        if let text = object["text"] as? String {
            return text
        }

        if let delta = object["delta"] as? [String: Any] {
            if let text = delta["text"] as? String {
                return text
            }
            if let content = delta["content"] as? String {
                return content
            }
        }

        if let choices = object["choices"] as? [[String: Any]] {
            if let delta = choices.first?["delta"] as? [String: Any],
               let content = delta["content"] as? String {
                return content
            }
            if let message = choices.first?["message"] as? [String: Any],
               let content = message["content"] as? String {
                return content
            }
        }

        if let candidates = object["candidates"] as? [[String: Any]],
           let content = candidates.first?["content"] as? [String: Any],
           let parts = content["parts"] as? [[String: Any]] {
            let text = parts.compactMap { $0["text"] as? String }.joined()
            if !text.isEmpty {
                return text
            }
        }

        if let message = object["message"] as? [String: Any],
           let content = message["content"] as? String {
            return content
        }

        if let message = object["message"] as? [String: Any],
           let blocks = message["content"] as? [[String: Any]] {
            let text = blocks.compactMap { block -> String? in
                guard block["type"] as? String == "text" else { return nil }
                return block["text"] as? String
            }.joined()
            return text.isEmpty ? nil : text
        }

        return nil
    }

    private static func extractReasoningDelta(from object: [String: Any]) -> String? {
        if let thinking = object["thinking"] as? String {
            return thinking
        }

        if let delta = object["delta"] as? [String: Any] {
            if let thinking = delta["thinking"] as? String {
                return thinking
            }
            if let text = delta["text"] as? String {
                return text
            }
        }

        return nil
    }

    private static func extractFinalContent(from object: [String: Any]) -> String? {
        if let content = object["content"] as? String, !content.isEmpty {
            return content
        }

        if let message = object["message"] as? [String: Any],
           let content = message["content"] as? String,
           !content.isEmpty {
            return content
        }

        guard let parts = object["parts"] as? [[String: Any]] else {
            return nil
        }

        let textParts = parts.compactMap { part -> String? in
            guard part["type"] as? String == "text" else {
                return nil
            }
            return part["text"] as? String
        }

        let content = textParts.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
        return content.isEmpty ? nil : content
    }

    private static func extractStreamMetadata(from object: [String: Any]) -> ChatStreamMetadata {
        let decoded: ChatStreamMetadata?
        if let data = try? JSONSerialization.data(withJSONObject: object) {
            decoded = try? JSONDecoder().decode(ChatStreamMetadata.self, from: data)
        } else {
            decoded = nil
        }

        return ChatStreamMetadata(
            messageId: decoded?.messageId ?? object["message_id"] as? String,
            content: decoded?.content ?? extractFinalContent(from: object),
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
    private var buffer = Data()

    mutating func append(_ data: Data) throws -> [ChatStreamEvent] {
        buffer.append(data)
        return try drainCompletedEvents()
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
