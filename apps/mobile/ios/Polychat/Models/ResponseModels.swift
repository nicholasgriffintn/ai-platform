import Foundation

public struct ResponseReceipt: Codable, Equatable {
    public let idempotencyKey: String
    public let kind: String
    public let acceptedAt: String
    public let duplicate: Bool

    enum CodingKeys: String, CodingKey {
        case kind, duplicate
        case idempotencyKey = "idempotency_key"
        case acceptedAt = "accepted_at"
    }

    public init(idempotencyKey: String, kind: String, acceptedAt: String, duplicate: Bool) {
        self.idempotencyKey = idempotencyKey
        self.kind = kind
        self.acceptedAt = acceptedAt
        self.duplicate = duplicate
    }
}

public struct PlatformResponse: Codable, Equatable {
    public let id: String
    public let conversationId: String
    public let status: String
    public let waitingOn: String?
    public let attempt: Int
    public let trigger: String
    public let initiatorUserId: Int?
    public let projectId: String?
    public let projectTaskId: String?
    public let stageId: String?
    public let createdAt: String
    public let updatedAt: String
    public let startedAt: String?
    public let completedAt: String?
    public let cancellationRequestedAt: String?
    public let terminalReason: String?
    public let lastItemId: String?
    public let context: ChatContextSnapshot?
    public let retry: ChatRetrySnapshot?
    public let provenance: RunProvenance?
    public let usage: ResponseUsage?
    public let receipt: ResponseReceipt?
    public let output: [ChatMessage]?

    enum CodingKeys: String, CodingKey {
        case id, status, attempt, trigger, context, retry, provenance, usage, receipt, output
        case conversationId = "conversation_id"
        case waitingOn = "waiting_on"
        case initiatorUserId = "initiator_user_id"
        case projectId = "project_id"
        case projectTaskId = "project_task_id"
        case stageId = "stage_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case startedAt = "started_at"
        case completedAt = "completed_at"
        case cancellationRequestedAt = "cancellation_requested_at"
        case terminalReason = "terminal_reason"
        case lastItemId = "last_item_id"
    }

    public init(
        id: String,
        conversationId: String,
        status: String,
        waitingOn: String? = nil,
        attempt: Int,
        trigger: String = "user",
        initiatorUserId: Int? = nil,
        projectId: String? = nil,
        projectTaskId: String? = nil,
        stageId: String? = nil,
        createdAt: String,
        updatedAt: String,
        startedAt: String? = nil,
        completedAt: String? = nil,
        cancellationRequestedAt: String? = nil,
        terminalReason: String? = nil,
        lastItemId: String? = nil,
        context: ChatContextSnapshot? = nil,
        retry: ChatRetrySnapshot? = nil,
        provenance: RunProvenance? = nil,
        usage: ResponseUsage? = nil,
        receipt: ResponseReceipt? = nil,
        output: [ChatMessage]? = nil
    ) {
        self.id = id
        self.conversationId = conversationId
        self.status = status
        self.waitingOn = waitingOn
        self.attempt = attempt
        self.trigger = trigger
        self.initiatorUserId = initiatorUserId
        self.projectId = projectId
        self.projectTaskId = projectTaskId
        self.stageId = stageId
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.startedAt = startedAt
        self.completedAt = completedAt
        self.cancellationRequestedAt = cancellationRequestedAt
        self.terminalReason = terminalReason
        self.lastItemId = lastItemId
        self.context = context
        self.retry = retry
        self.provenance = provenance
        self.usage = usage
        self.receipt = receipt
        self.output = output
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        conversationId = try container.decode(String.self, forKey: .conversationId)
        status = try container.decode(String.self, forKey: .status)
        waitingOn = try container.decodeIfPresent(String.self, forKey: .waitingOn)
        attempt = try container.decode(Int.self, forKey: .attempt)
        trigger = try container.decodeIfPresent(String.self, forKey: .trigger) ?? "user"
        initiatorUserId = try container.decodeIfPresent(Int.self, forKey: .initiatorUserId)
        projectId = try container.decodeIfPresent(String.self, forKey: .projectId)
        projectTaskId = try container.decodeIfPresent(String.self, forKey: .projectTaskId)
        stageId = try container.decodeIfPresent(String.self, forKey: .stageId)
        createdAt = try container.decode(String.self, forKey: .createdAt)
        updatedAt = try container.decode(String.self, forKey: .updatedAt)
        startedAt = try container.decodeIfPresent(String.self, forKey: .startedAt)
        completedAt = try container.decodeIfPresent(String.self, forKey: .completedAt)
        cancellationRequestedAt = try container.decodeIfPresent(String.self, forKey: .cancellationRequestedAt)
        terminalReason = try container.decodeIfPresent(String.self, forKey: .terminalReason)
        lastItemId = try container.decodeIfPresent(String.self, forKey: .lastItemId)
        context = try container.decodeIfPresent(ChatContextSnapshot.self, forKey: .context)
        retry = try container.decodeIfPresent(ChatRetrySnapshot.self, forKey: .retry)
        provenance = try container.decodeIfPresent(RunProvenance.self, forKey: .provenance)
        usage = try container.decodeIfPresent(ResponseUsage.self, forKey: .usage)
        receipt = try container.decodeIfPresent(ResponseReceipt.self, forKey: .receipt)
        output = try container.decodeIfPresent([ConversationItemMessage].self, forKey: .output)?.map(\.message)
    }

    public var lastAssistantText: String? {
        output?.last { $0.role == "assistant" }?.textContent
    }
}

public struct ResponseSnapshot: Decodable, Equatable {
    public let cursor: Int
    public let response: PlatformResponse
    public let messages: [ChatMessage]

    enum CodingKeys: String, CodingKey {
        case cursor
    }

    public init(cursor: Int, response: PlatformResponse, messages: [ChatMessage]) {
        self.cursor = cursor
        self.response = response
        self.messages = messages
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let decodedResponse = try PlatformResponse(from: decoder)
        cursor = try container.decode(Int.self, forKey: .cursor)
        response = decodedResponse
        messages = decodedResponse.output ?? []
    }
}

public struct ResponseEventRecord: Codable, Equatable {
    public let id: String
    public let responseId: String
    public let sequence: Int
    public let attempt: Int
    public let type: String
    public let occurredAt: String
    public let data: [String: JSONValue]

    enum CodingKeys: String, CodingKey {
        case id, sequence, attempt, type, data
        case responseId = "response_id"
        case occurredAt = "occurred_at"
    }

    public init(
        id: String,
        responseId: String,
        sequence: Int,
        attempt: Int,
        type: String,
        occurredAt: String,
        data: [String: JSONValue]
    ) {
        self.id = id
        self.responseId = responseId
        self.sequence = sequence
        self.attempt = attempt
        self.type = type
        self.occurredAt = occurredAt
        self.data = data
    }
}

public struct ResponseReplayResponse: Decodable, Equatable {
    public let responseId: String
    public let fromCursor: Int
    public let nextCursor: Int
    public let resetRequired: Bool
    public let events: [ResponseEventRecord]
    public let snapshot: ResponseSnapshot?

    enum CodingKeys: String, CodingKey {
        case events, snapshot
        case responseId = "response_id"
        case fromCursor = "from_cursor"
        case nextCursor = "next_cursor"
        case resetRequired = "reset_required"
    }

    public init(
        responseId: String,
        fromCursor: Int,
        nextCursor: Int,
        resetRequired: Bool,
        events: [ResponseEventRecord],
        snapshot: ResponseSnapshot?
    ) {
        self.responseId = responseId
        self.fromCursor = fromCursor
        self.nextCursor = nextCursor
        self.resetRequired = resetRequired
        self.events = events
        self.snapshot = snapshot
    }
}

struct CancelResponseRequest: Encodable {
    let expectedAttempt: Int
    let idempotencyKey: String

    enum CodingKeys: String, CodingKey {
        case expectedAttempt = "expected_attempt"
        case idempotencyKey = "idempotency_key"
    }
}

enum ResponseInputItem: Encodable {
    case item(ConversationItem)
    case approval(approvalId: String)

    private enum ApprovalKeys: String, CodingKey {
        case type
        case approvalId = "approval_id"
    }

    func encode(to encoder: Encoder) throws {
        switch self {
        case .item(let item):
            try item.encode(to: encoder)
        case .approval(let approvalId):
            var container = encoder.container(keyedBy: ApprovalKeys.self)
            try container.encode("approval_response", forKey: .type)
            try container.encode(approvalId, forKey: .approvalId)
        }
    }
}

public struct CreateResponseRequest: Encodable {
    struct ConversationReference: Encodable {
        let id: String
    }

    struct Environment: Encodable {
        let type: String
    }

    struct Client: Encodable {
        let platform: String
    }

    struct Sampling: Encodable {
        let temperature: Double?
        let topP: Double?
        let maxOutputTokens: Int?
        let presencePenalty: Double?
        let frequencyPenalty: Double?

        enum CodingKeys: String, CodingKey {
            case temperature
            case topP = "top_p"
            case maxOutputTokens = "max_output_tokens"
            case presencePenalty = "presence_penalty"
            case frequencyPenalty = "frequency_penalty"
        }

        var isEmpty: Bool {
            temperature == nil && topP == nil && maxOutputTokens == nil
                && presencePenalty == nil && frequencyPenalty == nil
        }
    }

    struct TextSettings: Encodable {
        let verbosity: String
    }

    enum Tool: Encodable, Equatable {
        case managed
        case hosted(String)
        case builtin(String)

        static let hostedTypes: Set<String> = [
            "web_search", "code_interpreter", "file_search", "computer_use",
            "shell", "image_generation", "tool_search"
        ]

        private enum CodingKeys: String, CodingKey {
            case type, id
        }

        static func selection(for enabledTools: [String]) -> [Tool] {
            [.managed] + enabledTools.map { hostedTypes.contains($0) ? .hosted($0) : .builtin($0) }
        }

        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            switch self {
            case .managed:
                try container.encode("managed", forKey: .type)
            case .hosted(let type):
                try container.encode(type, forKey: .type)
            case .builtin(let id):
                try container.encode("builtin", forKey: .type)
                try container.encode(id, forKey: .id)
            }
        }
    }

    let conversation: ConversationReference?
    let input: [ResponseInputItem]
    let model: String?
    let provider: String?
    let modelTier: String?
    let environment: Environment?
    let tools: [Tool]
    let reasoning: ReasoningSettings?
    let sampling: Sampling?
    let text: TextSettings?
    let serviceTier: String?
    let stream: Bool
    let store: Bool
    let idempotencyKey: String
    let responseId: String?
    let client: Client

    enum CodingKeys: String, CodingKey {
        case conversation, input, model, provider, environment, tools, reasoning, sampling, text, stream, store, client
        case modelTier = "model_tier"
        case serviceTier = "service_tier"
        case idempotencyKey = "idempotency_key"
        case responseId = "response_id"
    }

    public init(
        messages: [ChatMessage],
        model: String?,
        provider: String? = nil,
        store: Bool = true,
        conversationId: String? = nil,
        settings: ChatSettings? = nil,
        stream: Bool = false,
        modelTier: String? = nil,
        computeSite: String? = nil,
        idempotencyKey: String = UUID().uuidString,
        responseId: String? = nil,
        connectorApprovalId: String? = nil
    ) {
        self.conversation = conversationId.map(ConversationReference.init)
        self.input = ConversationItem.inputItems(from: messages).map(ResponseInputItem.item)
            + (connectorApprovalId.map { [ResponseInputItem.approval(approvalId: $0)] } ?? [])
        self.model = model
        self.provider = provider
        self.modelTier = model == nil ? modelTier : nil
        self.environment = computeSite.map(Environment.init)
        self.tools = Tool.selection(for: settings?.enabledTools ?? [])
        self.reasoning = settings?.reasoningEffort.map { ReasoningSettings(effort: $0.rawValue) }
        let sampling = Sampling(
            temperature: settings?.temperature,
            topP: settings?.topP,
            maxOutputTokens: settings?.maxTokens,
            presencePenalty: settings?.presencePenalty,
            frequencyPenalty: settings?.frequencyPenalty
        )
        self.sampling = sampling.isEmpty ? nil : sampling
        self.text = settings?.verbosity.map { TextSettings(verbosity: $0.rawValue) }
        self.serviceTier = settings?.serviceTier?.rawValue
        self.stream = stream
        self.store = store
        self.idempotencyKey = idempotencyKey
        self.responseId = responseId
        self.client = Client(platform: "mobile")
    }

    var hasMessages: Bool {
        input.contains { item in
            if case .item = item {
                return true
            }
            return false
        }
    }
}

public struct TitleGenerationRequest: Encodable {
    let items: [ConversationItem]

    init(messages: [ChatMessage]) {
        self.items = ConversationItem.inputItems(from: messages)
    }
}

public struct TitleGenerationResponse: Codable {
    public let title: String
}

public struct UpdateConversationRequest: Encodable {
    let title: String?
    let items: [ConversationItem]?
    let parentConversationId: String?
    let parentMessageId: String?

    enum CodingKeys: String, CodingKey {
        case title, items
        case parentConversationId = "parent_conversation_id"
        case parentMessageId = "parent_message_id"
    }

    init(
        title: String? = nil,
        messages: [ChatMessage]? = nil,
        parentConversationId: String? = nil,
        parentMessageId: String? = nil
    ) {
        self.title = title
        self.items = messages.map(ConversationItem.storedItems)
        self.parentConversationId = parentConversationId
        self.parentMessageId = parentMessageId
    }
}

public struct ConversationListResponse: Decodable {
    public let conversations: [ConversationSummary]
    public let totalPages: Int
    public let pageNumber: Int
    public let pageSize: Int

    enum CodingKeys: String, CodingKey {
        case conversations = "data"
        case totalPages = "pages"
        case pageNumber = "page"
        case pageSize = "limit"
    }

    public struct ConversationSummary: Decodable, Identifiable {
        public let id: String
        public let title: String?
        public let createdAt: String
        public let updatedAt: String
        public let model: String?
        public let modelTier: String?
        public let isArchived: Bool
        public let userId: Int?
        public let shareId: String?
        public let lastMessageAt: String?
        public let messageCount: Int?

        enum CodingKeys: String, CodingKey {
            case id, title, model
            case modelTier = "model_tier"
            case createdAt = "created_at"
            case updatedAt = "updated_at"
            case isArchived = "is_archived"
            case userId = "user_id"
            case shareId = "share_id"
            case lastMessageAt = "last_message_at"
            case messageCount = "item_count"
        }

        public init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            id = try container.decode(String.self, forKey: .id)
            title = try container.decodeIfPresent(String.self, forKey: .title)
            createdAt = try container.decode(String.self, forKey: .createdAt)
            updatedAt = try container.decode(String.self, forKey: .updatedAt)
            model = try container.decodeIfPresent(String.self, forKey: .model)
            modelTier = try container.decodeIfPresent(String.self, forKey: .modelTier)
            isArchived = try container.decodeFlexibleBool(forKey: .isArchived)
            userId = try container.decodeFlexibleIntIfPresent(forKey: .userId)
            shareId = try container.decodeIfPresent(String.self, forKey: .shareId)
            lastMessageAt = try container.decodeIfPresent(String.self, forKey: .lastMessageAt)
            messageCount = try container.decodeIfPresent(Int.self, forKey: .messageCount)
        }
    }
}

public struct ConversationDetailResponse: Decodable {
    public let id: String
    public let title: String?
    public let createdAt: String
    public let updatedAt: String
    public let model: String?
    public let modelTier: String?
    public let isArchived: Bool
    public let messages: [ChatMessage]
    public let shareId: String?
    public let lastMessageAt: String?
    public let messageCount: Int?
    public let latestResponse: PlatformResponse?
    public let hasMoreMessages: Bool
    public let oldestMessageId: String?

    enum CodingKeys: String, CodingKey {
        case id, title, model, items
        case modelTier = "model_tier"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case isArchived = "is_archived"
        case shareId = "share_id"
        case lastMessageAt = "last_message_at"
        case messageCount = "item_count"
        case latestResponse = "latest_response"
        case hasMoreMessages = "has_more_items"
        case oldestMessageId = "oldest_item_id"
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        createdAt = try container.decode(String.self, forKey: .createdAt)
        updatedAt = try container.decode(String.self, forKey: .updatedAt)
        model = try container.decodeIfPresent(String.self, forKey: .model)
        modelTier = try container.decodeIfPresent(String.self, forKey: .modelTier)
        isArchived = try container.decodeFlexibleBool(forKey: .isArchived)
        messages = try container.decodeIfPresent([ConversationItemMessage].self, forKey: .items)?.map(\.message) ?? []
        shareId = try container.decodeIfPresent(String.self, forKey: .shareId)
        lastMessageAt = try container.decodeIfPresent(String.self, forKey: .lastMessageAt)
        messageCount = try container.decodeIfPresent(Int.self, forKey: .messageCount)
        latestResponse = try container.decodeIfPresent(PlatformResponse.self, forKey: .latestResponse)
        hasMoreMessages = try container.decodeIfPresent(Bool.self, forKey: .hasMoreMessages) ?? false
        oldestMessageId = try container.decodeIfPresent(String.self, forKey: .oldestMessageId)
    }
}

public struct ConversationMessagePageResponse: Decodable {
    public let messages: [ChatMessage]
    public let hasMore: Bool
    public let oldestMessageId: String?

    enum CodingKeys: String, CodingKey {
        case messages = "data"
        case hasMore = "has_more"
        case oldestMessageId = "oldest_item_id"
    }

    public init(messages: [ChatMessage], hasMore: Bool, oldestMessageId: String?) {
        self.messages = messages
        self.hasMore = hasMore
        self.oldestMessageId = oldestMessageId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        messages = try container.decodeIfPresent([ConversationItemMessage].self, forKey: .messages)?.map(\.message) ?? []
        hasMore = try container.decodeIfPresent(Bool.self, forKey: .hasMore) ?? false
        oldestMessageId = try container.decodeIfPresent(String.self, forKey: .oldestMessageId)
    }
}
