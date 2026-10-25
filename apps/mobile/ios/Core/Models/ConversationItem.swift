import Foundation

struct ConversationItem: Encodable {
    let message: ChatMessage
    let includesParts: Bool

    static func inputItems(from messages: [ChatMessage]) -> [ConversationItem] {
        ChatMessage.providerMessages(from: messages).map { message in
            ConversationItem(message: message, includesParts: shouldSendParts(for: message))
        }
    }

    static func storedItems(from messages: [ChatMessage]) -> [ConversationItem] {
        messages.map { ConversationItem(message: $0, includesParts: $0.parts?.isEmpty == false) }
    }

    static func itemType(forRole role: String) -> String {
        switch role {
        case "tool":
            return "tool_output"
        case "compaction", "goal":
            return role
        default:
            return "message"
        }
    }

    static func itemRole(forRole role: String) -> String {
        ["user", "assistant", "system", "developer"].contains(role) ? role : "user"
    }

    private static func shouldSendParts(for message: ChatMessage) -> Bool {
        guard message.parts?.isEmpty == false else {
            return false
        }

        if case .text(let text) = ChatRequestContent(message: message) {
            return text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }

        return false
    }

    enum CodingKeys: String, CodingKey {
        case type, role, id, status, content, parts, name, data, metadata
    }

    enum MetadataKeys: String, CodingKey {
        case model, citations, reasoning, timestamp, created, name, data
        case logId = "log_id"
        case runId = "run_id"
        case completionId = "completion_id"
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        let type = Self.itemType(forRole: message.role)
        try container.encode(type, forKey: .type)
        if type == "message" {
            try container.encode(Self.itemRole(forRole: message.role), forKey: .role)
        }
        try container.encode(message.id, forKey: .id)
        try container.encodeIfPresent(message.status, forKey: .status)
        try container.encode(Self.contentBlocks(for: message), forKey: .content)
        if includesParts {
            try container.encodeIfPresent(message.parts, forKey: .parts)
        }
        if type == "tool_output" {
            try container.encodeIfPresent(message.name, forKey: .name)
            try container.encodeIfPresent(message.data, forKey: .data)
        }

        var metadata = container.nestedContainer(keyedBy: MetadataKeys.self, forKey: .metadata)
        try metadata.encodeIfPresent(message.model, forKey: .model)
        try metadata.encodeIfPresent(message.citations, forKey: .citations)
        try metadata.encodeIfPresent(message.reasoning, forKey: .reasoning)
        try metadata.encodeIfPresent(message.timestamp, forKey: .timestamp)
        try metadata.encodeIfPresent(message.created, forKey: .created)
        try metadata.encodeIfPresent(message.logId, forKey: .logId)
        try metadata.encodeIfPresent(message.runId, forKey: .runId)
        try metadata.encodeIfPresent(message.completionId, forKey: .completionId)
        if type != "tool_output" {
            try metadata.encodeIfPresent(message.name, forKey: .name)
            try metadata.encodeIfPresent(message.data, forKey: .data)
        }
    }

    private static func contentBlocks(for message: ChatMessage) -> [MessageContentBlock] {
        switch ChatRequestContent(message: message) {
        case .text(let text):
            return [.text(MessageContentBlock.TextBlock(text: text))]
        case .blocks(let blocks):
            return blocks
        }
    }
}

enum ConversationItemDecoding {
    private static let contentBlockTypes: Set<String> = [
        "text", "image_url", "audio_url", "input_audio", "document_url",
        "markdown_document", "artifact", "thinking"
    ]

    static func messageObject(from item: [String: Any]) -> [String: Any] {
        var object = item["metadata"] as? [String: Any] ?? [:]
        let type = item["type"] as? String ?? "message"

        switch type {
        case "tool_output":
            object["role"] = "tool"
            if let callId = item["call_id"] {
                object["tool_call_id"] = callId
            }
            if let arguments = item["arguments"] {
                object["tool_call_arguments"] = arguments
            }
            if let name = item["name"] {
                object["name"] = name
            }
            if let data = item["data"] {
                object["data"] = data
            }
        case "message":
            object["role"] = item["role"] as? String ?? "user"
        default:
            object["role"] = type
        }

        if let id = item["id"] {
            object["id"] = id
        }
        if let status = item["status"] {
            object["status"] = status
        }
        if let parts = item["parts"] {
            object["parts"] = parts
        }
        object["content"] = content(from: item["content"])

        return object
    }

    static func message(from item: [String: Any]) -> ChatMessage? {
        JSONObjectDecoding.decode(ChatMessage.self, from: messageObject(from: item))
    }

    static func text(from content: Any?) -> String {
        guard let parts = content as? [[String: Any]] else {
            return content as? String ?? ""
        }

        return parts.compactMap { part -> String? in
            part["type"] as? String == "text" ? part["text"] as? String : nil
        }.joined(separator: "\n")
    }

    private static func content(from content: Any?) -> Any {
        guard let parts = content as? [[String: Any]] else {
            return content as? String ?? ""
        }

        if parts.count == 1,
           let part = parts.first,
           part["type"] as? String == "text",
           Set(part.keys).isSubset(of: ["type", "text"]) {
            return part["text"] as? String ?? ""
        }

        let decodable = parts.allSatisfy { part in
            (part["type"] as? String).map(contentBlockTypes.contains) == true
        }

        return decodable && !parts.isEmpty ? parts : text(from: parts)
    }
}

struct ConversationItemMessage: Decodable {
    let message: ChatMessage

    init(from decoder: Decoder) throws {
        let value = try JSONValue(from: decoder)
        let data = try JSONEncoder().encode(value)
        guard let item = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw DecodingError.dataCorrupted(DecodingError.Context(
                codingPath: decoder.codingPath,
                debugDescription: "Conversation item must be an object"
            ))
        }

        let object = ConversationItemDecoding.messageObject(from: item)
        message = try JSONDecoder().decode(ChatMessage.self, from: JSONSerialization.data(withJSONObject: object))
    }
}
