import Foundation

enum ChatStreamEvent: Equatable {
    case content(String)
    case reasoning(String)
    case state(String)
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
    let logId: String?
    let model: String?
    let timestamp: Double?

    enum CodingKeys: String, CodingKey {
        case id, name, status, content, data, model, timestamp
        case toolCallId = "tool_call_id"
        case logId = "log_id"
    }
}

struct ChatUsageLimits: Decodable, Equatable {
    struct Allowance: Decodable, Equatable {
        let used: Int?
        let limit: Int?
    }

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

    let daily: Allowance?
    let credits: Credits?

    init(
        daily: Allowance?,
        credits: Credits? = nil
    ) {
        self.daily = daily
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
