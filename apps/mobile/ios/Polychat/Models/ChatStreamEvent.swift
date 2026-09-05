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
    case turnActivity(ChatTurnActivityEvent)
    case usageLimits(ChatUsageLimits)
    case metadata(ChatStreamMetadata)
    case done
}

enum ChatTurnActivityEvent: Equatable {
    enum ToolOutcome: String, Equatable {
        case success
        case failure
    }

    enum WaitReason: String, Equatable {
        case question
        case approval
        case selection
    }

    enum StepOutcome: String, Equatable {
        case toolCalls = "tool_calls"
        case completed
        case failed
        case cancelled
        case waiting
    }

    enum TurnOutcome: String, Equatable {
        case completed
        case failed
        case cancelled
        case waiting
    }

    case turnStarted
    case modelStepStarted(step: Int)
    case reasoningStarted(step: Int)
    case reasoningFinished(step: Int)
    case responseStarted(step: Int)
    case responseFinished(step: Int)
    case toolInputStarted(step: Int, toolCallId: String, toolName: String)
    case toolInputFinished(step: Int, toolCallId: String, toolName: String)
    case toolExecutionStarted(step: Int, toolCallId: String, toolName: String)
    case toolFinished(step: Int, toolCallId: String, toolName: String, outcome: ToolOutcome)
    case waitingForUser(step: Int, toolCallId: String, toolName: String, reason: WaitReason)
    case modelStepFinished(step: Int, outcome: StepOutcome)
    case turnFinished(outcome: TurnOutcome, errorType: String?)
}

struct ChatToolCallEvent: Equatable {
    let toolCallId: String
    let name: String?
    let parameters: JSONValue?
    let parameterFragment: String?

    init(
        toolCallId: String,
        name: String? = nil,
        parameters: JSONValue? = nil,
        parameterFragment: String? = nil
    ) {
        self.toolCallId = toolCallId
        self.name = name
        self.parameters = parameters
        self.parameterFragment = parameterFragment
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
