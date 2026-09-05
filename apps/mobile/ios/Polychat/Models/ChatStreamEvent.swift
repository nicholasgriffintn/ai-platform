import Foundation

enum ChatStreamEvent: Equatable {
    case content(String)
    case reasoning(String)
    case state(String)
    case run(ChatRunCommandReceipt)
    case conversationTitle(String)
    case compaction(ChatMessage)
    case toolUseStart(ChatToolCallEvent)
    case toolUseDelta(ChatToolCallEvent)
    case toolUseStop(String)
    case toolResult(ChatToolResultEvent)
    case usageLimits(ChatUsageLimits)
    case metadata(ChatStreamMetadata)
    case done
}

struct ChatToolCallEvent: Equatable {
    let toolCallId: String
    let name: String?
    let parameters: JSONValue?

    init(toolCallId: String, name: String? = nil, parameters: JSONValue? = nil) {
        self.toolCallId = toolCallId
        self.name = name
        self.parameters = parameters
    }
}

struct ChatToolResultEvent: Decodable, Equatable {
    let id: String?
    let toolCallId: String?
    let name: String?
    let status: String?
    let content: JSONValue?
    let data: ChatMessageData?
    let structuredData: JSONValue?
    let logId: String?
    let model: String?
    let timestamp: Double?

    enum CodingKeys: String, CodingKey {
        case id, name, status, content, data, model, timestamp
        case toolCallId = "tool_call_id"
        case logId = "log_id"
    }

    init(
        id: String?,
        toolCallId: String?,
        name: String?,
        status: String?,
        content: JSONValue?,
        data: ChatMessageData?,
        structuredData: JSONValue? = nil,
        logId: String?,
        model: String?,
        timestamp: Double?
    ) {
        self.id = id
        self.toolCallId = toolCallId
        self.name = name
        self.status = status
        self.content = content
        self.data = data
        self.structuredData = structuredData
        self.logId = logId
        self.model = model
        self.timestamp = timestamp
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id)
        toolCallId = try container.decodeIfPresent(String.self, forKey: .toolCallId)
        name = try container.decodeIfPresent(String.self, forKey: .name)
        status = try container.decodeIfPresent(String.self, forKey: .status)
        content = try container.decodeIfPresent(JSONValue.self, forKey: .content)
        data = try container.decodeIfPresent(ChatMessageData.self, forKey: .data)
        structuredData = try container.decodeIfPresent(JSONValue.self, forKey: .data)
        logId = try container.decodeIfPresent(String.self, forKey: .logId)
        model = try container.decodeIfPresent(String.self, forKey: .model)
        timestamp = try container.decodeIfPresent(Double.self, forKey: .timestamp)
    }
}

struct ChatUsageLimits: Decodable, Equatable {
    struct Credits: Decodable, Equatable {
        let included: Double
        let used: Double
        let reserved: Double
        let grace: Double
        let overrun: Double
        let overage: Double
        let overageEnabled: Bool
        let state: String

        enum CodingKeys: String, CodingKey {
            case included, used, reserved, grace, overrun, overage, state
            case overageEnabled = "overage_enabled"
        }
    }

    let credits: Credits?

    init(credits: Credits? = nil) {
        self.credits = credits
    }
}

struct ChatStreamMetadata: Decodable, Equatable {
    let messageId: String?
    let content: String?
    let model: String?
    let parts: [ChatMessagePart]?
    let reasoning: ChatReasoning?
    let citations: [ChatCitation]?
    let data: ChatMessageData?
    let name: String?
    let status: String?
    let logId: String?
    let created: Double?

    enum CodingKeys: String, CodingKey {
        case content, model, parts, reasoning, citations, data, name, status, created
        case messageId = "message_id"
        case logId = "log_id"
    }
}
