import Foundation
public struct ChatCompletionResponse: Codable {
    public let choices: [ChatChoice]
    public let run: ChatRunCommandReceipt?

    public struct ChatChoice: Codable {
        public let message: ChatMessage
    }
}

public struct ChatCompletionRequest: Encodable {
    let messages: [ChatRequestMessage]
    let model: String?
    let provider: String?
    let platform: String
    let mode: String
    let store: Bool
    let stream: Bool
    let completionId: String?
    let options: [String: JSONValue]
    let temperature: Double?
    let topP: Double?
    let maxTokens: Int?
    let presencePenalty: Double?
    let frequencyPenalty: Double?
    let reasoning: ReasoningSettings?
    let reasoningEffort: String?
    let verbosity: String?
    let serviceTier: String?
    let enabledTools: [String]?
    let toolSelectionMode: String
    let modelRouterMode: String?
    let commandId: String
    let runId: String?
    let connectorApprovalId: String?

    enum CodingKeys: String, CodingKey {
        case messages, model, provider, platform, mode, store, stream, temperature, reasoning, verbosity, options
        case completionId = "completion_id"
        case topP = "top_p"
        case maxTokens = "max_tokens"
        case presencePenalty = "presence_penalty"
        case frequencyPenalty = "frequency_penalty"
        case reasoningEffort = "reasoning_effort"
        case serviceTier = "service_tier"
        case enabledTools = "enabled_tools"
        case toolSelectionMode = "tool_selection_mode"
        case modelRouterMode = "model_router_mode"
        case commandId = "command_id"
        case runId = "run_id"
        case connectorApprovalId = "connector_approval_id"
    }

    public init(
        messages: [ChatMessage],
        model: String?,
        provider: String? = nil,
        store: Bool = true,
        completionId: String? = nil,
        settings: ChatSettings? = nil,
        stream: Bool = false,
        commandId: String = UUID().uuidString,
        runId: String? = nil,
        connectorApprovalId: String? = nil
    ) {
        self.messages = ChatMessage.providerMessages(from: messages).map(ChatRequestMessage.init)
        self.model = model
        self.provider = provider
        self.platform = "mobile"
        self.mode = "remote"
        self.store = store
        self.stream = stream
        self.completionId = completionId
        self.options = settings?.toolOptions ?? [:]
        self.temperature = settings?.temperature
        self.topP = settings?.topP
        self.maxTokens = settings?.maxTokens
        self.presencePenalty = settings?.presencePenalty
        self.frequencyPenalty = settings?.frequencyPenalty
        self.reasoning = settings?.reasoningEffort.map { ReasoningSettings(effort: $0.rawValue) }
        self.reasoningEffort = settings?.reasoningEffort?.rawValue
        self.verbosity = settings?.verbosity?.rawValue
        self.serviceTier = settings?.serviceTier?.rawValue
        self.enabledTools = settings?.enabledTools.isEmpty == false ? settings?.enabledTools : nil
        self.toolSelectionMode = "managed"
        self.modelRouterMode = model == nil ? "auto" : nil
        self.commandId = commandId
        self.runId = runId
        self.connectorApprovalId = connectorApprovalId
    }
}

public struct ChatRun: Codable, Equatable {
    public let protocolVersion: Int
    public let id: String
    public let conversationId: String
    public let projectId: String?
    public let projectTaskId: String?
    public let stageId: String?
    public let initiatorUserId: Int
    public let status: String
    public let attempt: Int
    public let createdAt: String
    public let updatedAt: String
    public let startedAt: String?
    public let completedAt: String?
    public let cancellationRequestedAt: String?
    public let terminalReason: String?
    public let lastMessageId: String?
    public let context: ChatContextSnapshot?
    public let retry: ChatRetrySnapshot?
    public let usage: ChatRunUsage?

    public init(
        protocolVersion: Int,
        id: String,
        conversationId: String,
        projectId: String?,
        projectTaskId: String?,
        stageId: String? = nil,
        initiatorUserId: Int,
        status: String,
        attempt: Int,
        createdAt: String,
        updatedAt: String,
        startedAt: String?,
        completedAt: String?,
        cancellationRequestedAt: String? = nil,
        terminalReason: String?,
        lastMessageId: String?,
        context: ChatContextSnapshot? = nil,
        retry: ChatRetrySnapshot? = nil,
        usage: ChatRunUsage? = nil
    ) {
        self.protocolVersion = protocolVersion
        self.id = id
        self.conversationId = conversationId
        self.projectId = projectId
        self.projectTaskId = projectTaskId
        self.stageId = stageId
        self.initiatorUserId = initiatorUserId
        self.status = status
        self.attempt = attempt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.startedAt = startedAt
        self.completedAt = completedAt
        self.cancellationRequestedAt = cancellationRequestedAt
        self.terminalReason = terminalReason
        self.lastMessageId = lastMessageId
        self.context = context
        self.retry = retry
        self.usage = usage
    }
}

public struct ChatRunUsage: Codable, Equatable {
    public let protocolVersion: Int
    public let runId: String
    public let currentAttempt: Int
    public let measurement: String
    public let reservation: ChatRunUsageReservation?
    public let consumption: ChatRunUsageConsumption
    public let attempts: [ChatRunUsageAttempt]
    public let settlement: ChatRunUsageSettlement
}

public struct ChatRunUsageReservation: Codable, Equatable {
    public let creditMicros: Int
    public let status: String
    public let expiresAt: String?
    public let createdAt: String
    public let updatedAt: String?
}

public struct ChatRunUsageConsumption: Codable, Equatable {
    public let status: String
    public let eventCount: Int
    public let costMicros: Int?
    public let creditMicros: Int?
    public let estimatedPriceEventCount: Int
    public let bySource: [ChatRunUsageSourceSummary]
}

public struct ChatRunUsageSourceSummary: Codable, Equatable {
    public let source: String
    public let eventCount: Int
    public let costMicros: Int
    public let creditMicros: Int
    public let estimatedPriceEventCount: Int
}

public struct ChatRunUsageAttempt: Codable, Equatable {
    public let attempt: Int
    public let measurement: String
    public let inputTokens: Int?
    public let eventCount: Int
    public let costMicros: Int?
    public let creditMicros: Int?
    public let estimatedPriceEventCount: Int
}

public struct ChatRunUsageSettlement: Codable, Equatable {
    public let status: String
    public let at: String?
}

public struct ChatRetrySnapshot: Codable, Equatable {
    public let protocolVersion: Int
    public let step: Int
    public let attempt: Int
    public let maxAttempts: Int
    public let runRetry: Int
    public let maxRunRetries: Int
    public let phase: String
    public let classification: String
    public let reason: String
    public let scheduledAt: String
    public let retryAt: String?
}

public struct ChatContextSnapshot: Codable, Equatable {
    public let protocolVersion: Int
    public let runId: String
    public let conversationId: String
    public let attempt: Int
    public let step: Int
    public let model: String
    public let provider: String?
    public let generatedAt: String
    public let usage: ChatContextUsage
    public let messages: ChatContextMessageCounts
    public let sources: [ChatContextSource]
    public let skills: [ChatContextSkill]
    public let approvals: [ChatContextApproval]?
    public let summary: ChatContextSummary?
    public let omissions: [ChatContextOmission]
}

public struct ChatContextApproval: Codable, Equatable, Identifiable {
    public let id: String
    public let type: String
    public let status: String
    public let toolName: String?
    public let messageId: String?
}

public struct ChatContextUsage: Codable, Equatable {
    public let inputTokens: Int
    public let contextWindow: Int
    public let source: String
}

public struct ChatContextMessageCounts: Codable, Equatable {
    public let included: Int
    public let omitted: Int
}

public struct ChatContextSource: Codable, Equatable, Identifiable {
    public let id: String
    public let name: String
    public let status: String
    public let retrievalPath: String?
    public let messageId: String?
}

public struct ChatContextSkill: Codable, Equatable, Identifiable {
    public let id: String
    public let name: String
    public let state: String
    public let revision: Int?
}

public struct ChatContextSummary: Codable, Equatable {
    public let messageId: String
    public let status: String
    public let text: String
    public let representedMessageCount: Int
    public let candidateMessageCount: Int
    public let fallback: Bool
}

public struct ChatContextOmission: Codable, Equatable, Identifiable {
    public let id: String
    public let kind: String
    public let reason: String
    public let count: Int
    public let messageId: String?
    public let retrievalPath: String?
}

public struct ChatRunCommandReceipt: Codable, Equatable {
    public let protocolVersion: Int
    public let commandId: String
    public let run: ChatRun
    public let kind: String
    public let acceptedAt: String
    public let duplicate: Bool
}

public struct ChatRunRecoveryResponse: Codable, Equatable {
    public let run: ChatRun
    public let messages: [ChatMessage]
}

public struct ChatRunSnapshotResponse: Codable, Equatable {
    public let protocolVersion: Int
    public let cursor: Int
    public let run: ChatRun
    public let messages: [ChatMessage]

    var recoveryResponse: ChatRunRecoveryResponse {
        ChatRunRecoveryResponse(run: run, messages: messages)
    }
}

public struct ChatRunEvent: Codable, Equatable {
    public let protocolVersion: Int
    public let id: String
    public let runId: String
    public let sequence: Int
    public let attempt: Int
    public let type: String
    public let occurredAt: String
    public let data: [String: JSONValue]
}

public struct ChatRunReplayResponse: Codable, Equatable {
    public let protocolVersion: Int
    public let runId: String
    public let fromCursor: Int
    public let nextCursor: Int
    public let resetRequired: Bool
    public let events: [ChatRunEvent]
    public let snapshot: ChatRunSnapshotResponse?
}

public struct ChatRunCommandReceiptResponse: Codable, Equatable {
    public let run: ChatRunCommandReceipt
}

struct CancelChatRunRequest: Encodable {
    let commandId: String
    let expectedAttempt: Int

    enum CodingKeys: String, CodingKey {
        case commandId = "command_id"
        case expectedAttempt = "expected_attempt"
    }
}

public struct ReasoningSettings: Codable, Equatable {
    public let effort: String
}

public struct TranscriptionResponse: Codable {
    let response: FunctionResponse
}

public struct FunctionResponse: Codable {
    let status: String?
    let content: String
}

public struct SpeechGenerationRequest: Codable {
    let input: String
    let store: Bool
}

public struct SpeechGenerationEnvelope: Codable {
    let response: SpeechGenerationResponse
}

public struct SpeechGenerationResponse: Codable {
    let status: String
    let content: String
    let data: SpeechGenerationData
}

public struct SpeechGenerationData: Codable {
    let audioKey: String?
    let audioUrl: String?
    let audioBase64: String?
    let audioDataUrl: String?
    let audioMimeType: String?
    let provider: String?
    let model: String?
    let response: String?
    let metadata: JSONValue?
}

public struct MarkdownConversionOptions: Codable, Equatable {
    public var image: ImageOptions?
    public var html: HTMLOptions?
    public var pdf: PDFOptions?

    public init(image: ImageOptions? = nil, html: HTMLOptions? = nil, pdf: PDFOptions? = nil) {
        self.image = image
        self.html = html
        self.pdf = pdf
    }

    public struct ImageOptions: Codable, Equatable {
        public var descriptionLanguage: String?

        public init(descriptionLanguage: String? = nil) {
            self.descriptionLanguage = descriptionLanguage
        }
    }

    public struct HTMLOptions: Codable, Equatable {
        public var hostname: String?
        public var cssSelector: String?

        public init(hostname: String? = nil, cssSelector: String? = nil) {
            self.hostname = hostname
            self.cssSelector = cssSelector
        }
    }

    public struct PDFOptions: Codable, Equatable {
        public var metadata: Bool?

        public init(metadata: Bool? = nil) {
            self.metadata = metadata
        }
    }
}

public struct UploadResponse: Codable {
    let url: String
    let type: String
    let name: String
    let markdown: String?
}

public struct ErrorResponse: Codable {
    let error: String
}

public struct ModelConfigItem: Codable, Identifiable {
    public var id: String = ""
    public let name: String?
    public let provider: String
    public let description: String?
    public let strengths: [String]?
    public let contextWindow: Int?
    public let pricing: ModelPricing?
    public let modalities: ModelModalities?
    public let supportsFunctions: Bool?
    public let multimodal: Bool?
    public let isFeatured: Bool?
    public let isDeprecated: Bool?
    public let isDefault: Bool?
    public let isExecutable: Bool?
    public let readiness: ModelReadiness?
    public let status: String?
    public let supportsAttachments: Bool?
    public let supportsDocuments: Bool?
    public let supportsAudio: Bool?
    public let supportsImageEdits: Bool?
    public let reasoningConfig: ReasoningConfig?
    public let supportedServiceTiers: [String]?
    public let serviceTierMultipliers: [String: Double]?
    
    public struct ReasoningConfig: Codable {
        public let supportedEffortLevels: [String]?

        public init(supportedEffortLevels: [String]?) {
            self.supportedEffortLevels = supportedEffortLevels
        }
    }
    
    public struct ModelPricing: Codable {
        public let costPer1kInputTokens: Double?
        public let costPer1kOutputTokens: Double?
    }
    
    public struct ModelModalities: Codable {
        public let input: [String]
        public let output: [String]?
    }
    
    enum CodingKeys: String, CodingKey {
        case name, provider, description, strengths, contextWindow, pricing, modalities, supportsFunctions, multimodal
        case isFeatured, featured, isDefault, isExecutable, readiness, status
        case isDeprecated, deprecated
        case reasoningConfig, supportedServiceTiers, serviceTierMultipliers
        case supportsAttachments, supportsDocuments, supportsAudio, supportsImageEdits
    }
    
    public init(
        id: String,
        name: String?,
        provider: String,
        description: String?,
        strengths: [String]?,
        contextWindow: Int?,
        pricing: ModelPricing?,
        modalities: ModelModalities?,
        supportsFunctions: Bool?,
        multimodal: Bool?,
        isFeatured: Bool? = nil,
        isDeprecated: Bool? = nil,
        isDefault: Bool? = nil,
        isExecutable: Bool? = nil,
        readiness: ModelReadiness? = nil,
        status: String? = nil,
        supportsAttachments: Bool? = nil,
        supportsDocuments: Bool? = nil,
        supportsAudio: Bool? = nil,
        supportsImageEdits: Bool? = nil,
        reasoningConfig: ReasoningConfig? = nil,
        supportedServiceTiers: [String]? = nil,
        serviceTierMultipliers: [String: Double]? = nil
    ) {
        self.id = id
        self.name = name
        self.provider = provider
        self.description = description
        self.strengths = strengths
        self.contextWindow = contextWindow
        self.pricing = pricing
        self.modalities = modalities
        self.supportsFunctions = supportsFunctions
        self.multimodal = multimodal
        self.isFeatured = isFeatured
        self.isDeprecated = isDeprecated
        self.isDefault = isDefault
        self.isExecutable = isExecutable
        self.readiness = readiness
        self.status = status
        self.supportsAttachments = supportsAttachments
        self.supportsDocuments = supportsDocuments
        self.supportsAudio = supportsAudio
        self.supportsImageEdits = supportsImageEdits
        self.reasoningConfig = reasoningConfig
        self.supportedServiceTiers = supportedServiceTiers
        self.serviceTierMultipliers = serviceTierMultipliers
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        name = try container.decodeIfPresent(String.self, forKey: .name)
        provider = try container.decode(String.self, forKey: .provider)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        strengths = try container.decodeIfPresent([String].self, forKey: .strengths)
        contextWindow = try container.decodeIfPresent(Int.self, forKey: .contextWindow)
        pricing = try container.decodeIfPresent(ModelPricing.self, forKey: .pricing)
        modalities = try container.decodeIfPresent(ModelModalities.self, forKey: .modalities)
        supportsFunctions = try container.decodeIfPresent(Bool.self, forKey: .supportsFunctions)
        multimodal = try container.decodeIfPresent(Bool.self, forKey: .multimodal)
        isFeatured = try container.decodeIfPresent(Bool.self, forKey: .isFeatured)
            ?? container.decodeIfPresent(Bool.self, forKey: .featured)
        isDeprecated = try container.decodeIfPresent(Bool.self, forKey: .isDeprecated)
            ?? container.decodeIfPresent(Bool.self, forKey: .deprecated)
        isDefault = try container.decodeIfPresent(Bool.self, forKey: .isDefault)
        isExecutable = try container.decodeIfPresent(Bool.self, forKey: .isExecutable)
        readiness = try container.decodeIfPresent(ModelReadiness.self, forKey: .readiness)
        status = try container.decodeIfPresent(String.self, forKey: .status)
        supportsAttachments = try container.decodeIfPresent(Bool.self, forKey: .supportsAttachments)
        supportsDocuments = try container.decodeIfPresent(Bool.self, forKey: .supportsDocuments)
        supportsAudio = try container.decodeIfPresent(Bool.self, forKey: .supportsAudio)
        supportsImageEdits = try container.decodeIfPresent(Bool.self, forKey: .supportsImageEdits)
        reasoningConfig = try container.decodeIfPresent(ReasoningConfig.self, forKey: .reasoningConfig)
        supportedServiceTiers = try container.decodeIfPresent([String].self, forKey: .supportedServiceTiers)
        serviceTierMultipliers = try container.decodeIfPresent([String: Double].self, forKey: .serviceTierMultipliers)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)

        try container.encodeIfPresent(name, forKey: .name)
        try container.encode(provider, forKey: .provider)
        try container.encodeIfPresent(description, forKey: .description)
        try container.encodeIfPresent(strengths, forKey: .strengths)
        try container.encodeIfPresent(contextWindow, forKey: .contextWindow)
        try container.encodeIfPresent(pricing, forKey: .pricing)
        try container.encodeIfPresent(modalities, forKey: .modalities)
        try container.encodeIfPresent(supportsFunctions, forKey: .supportsFunctions)
        try container.encodeIfPresent(multimodal, forKey: .multimodal)
        try container.encodeIfPresent(isFeatured, forKey: .isFeatured)
        try container.encodeIfPresent(isDeprecated, forKey: .isDeprecated)
        try container.encodeIfPresent(isDefault, forKey: .isDefault)
        try container.encodeIfPresent(isExecutable, forKey: .isExecutable)
        try container.encodeIfPresent(readiness, forKey: .readiness)
        try container.encodeIfPresent(status, forKey: .status)
        try container.encodeIfPresent(supportsAttachments, forKey: .supportsAttachments)
        try container.encodeIfPresent(supportsDocuments, forKey: .supportsDocuments)
        try container.encodeIfPresent(supportsAudio, forKey: .supportsAudio)
        try container.encodeIfPresent(supportsImageEdits, forKey: .supportsImageEdits)
        try container.encodeIfPresent(reasoningConfig, forKey: .reasoningConfig)
        try container.encodeIfPresent(supportedServiceTiers, forKey: .supportedServiceTiers)
        try container.encodeIfPresent(serviceTierMultipliers, forKey: .serviceTierMultipliers)
    }
}

public struct ModelReadiness: Codable, Equatable {
    public let protocolVersion: Int
    public let state: String
    public let reasonCode: String
    public let reason: String
    public let checkedAt: String
    public let expiresAt: String
    public let action: ModelReadinessAction?

    public init(
        protocolVersion: Int,
        state: String,
        reasonCode: String,
        reason: String,
        checkedAt: String,
        expiresAt: String,
        action: ModelReadinessAction? = nil
    ) {
        self.protocolVersion = protocolVersion
        self.state = state
        self.reasonCode = reasonCode
        self.reason = reason
        self.checkedAt = checkedAt
        self.expiresAt = expiresAt
        self.action = action
    }

    var isReady: Bool {
        state == "ready"
    }

    func isFresh(at date: Date = Date()) -> Bool {
        guard let expiry = AppDateParser.parse(expiresAt) else { return false }
        return expiry > date
    }
}

public struct ModelReadinessAction: Codable, Equatable {
    public let kind: String
    public let label: String
    public let path: String?

    public init(kind: String, label: String, path: String? = nil) {
        self.kind = kind
        self.label = label
        self.path = path
    }
}

public typealias ModelsResponse = [String: ModelConfigItem]

public struct AssistantRecipesResponse: Codable {
    public let recipes: [AssistantRecipe]
    public let categories: [String]
    public let filters: [String]
}

public struct AssistantRecipe: Codable, Identifiable, Equatable {
    public let id: String
    public let title: String
    public let summary: String
    public let description: String
    public let kind: String
    public let category: String
    public let featured: Bool
    public let integrations: [AssistantRecipeIntegration]
    public let triggers: [AssistantRecipeTrigger]
    public let actions: [String]
    public let setupPrompt: String
    public let enabledTools: [String]
    public let configurationFields: [RecipeConfigurationField]
}

public struct AssistantRecipeIntegration: Codable, Identifiable, Equatable {
    public let id: String
    public let providerId: String
    public let name: String
    public let description: String
    public let requiresConnection: Bool
    public let connectionGroup: String?
    public let operationIds: [String]?
    public let connectionStatus: String?
    public let setupUrl: String?
}

public struct AssistantRecipeTrigger: Codable, Equatable {
    public let type: String
    public let label: String
    public let description: String
}

public struct RecipeConfigurationField: Codable, Identifiable, Equatable {
    public var id: String { key }

    public let key: String
    public let label: String
    public let type: String
    public let required: Bool
    public let placeholder: String?
    public let defaultValue: RecipeConfigurationValue?
}

public enum RecipeConfigurationValue: Codable, Equatable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case stringList([String])
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode([String].self) {
            self = .stringList(value)
        } else {
            throw DecodingError.typeMismatch(
                RecipeConfigurationValue.self,
                DecodingError.Context(
                    codingPath: decoder.codingPath,
                    debugDescription: "Unsupported recipe configuration value"
                )
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value):
            try container.encode(value)
        case .number(let value):
            try container.encode(value)
        case .bool(let value):
            try container.encode(value)
        case .stringList(let value):
            try container.encode(value)
        case .null:
            try container.encodeNil()
        }
    }
}

public typealias RecipeConfiguration = [String: RecipeConfigurationValue]

public struct RecipeInstallationTrigger: Codable, Equatable {
    public let type: String
    public let enabled: Bool
    public let cronExpression: String?
    public let prompt: String?
    public let notificationChannel: String?
    public let notificationTarget: String?
}

public struct RecipeInstallation: Codable, Identifiable, Equatable {
    public let id: String
    public let recipeId: String
    public let userId: Int
    public let status: String
    public let triggers: [RecipeInstallationTrigger]
    public let configuration: RecipeConfiguration
    public let createdAt: String
    public let updatedAt: String
}

public struct AssistantRecipeInstallRequest: Codable {
    let channel: String
    let triggers: [RecipeInstallationTrigger]?
    let configuration: RecipeConfiguration?

    init(
        channel: String,
        triggers: [RecipeInstallationTrigger]? = nil,
        configuration: RecipeConfiguration? = nil
    ) {
        self.channel = channel
        self.triggers = triggers
        self.configuration = configuration
    }
}

public struct AssistantRecipeInstallResponse: Codable {
    public let recipe: AssistantRecipe
    public let conversationStarter: String
    public let messageUrl: String
    public let checklist: [String]
    public let connections: [AssistantRecipeConnection]
    public let readyToRun: Bool
    public let enabledTools: [String]
    public let installation: RecipeInstallation?
}

public struct AssistantRecipeConnection: Codable, Equatable {
    public let integrationId: String
    public let providerId: String
    public let name: String
    public let status: String
    public let requiresConnection: Bool
    public let setupUrl: String?
}

public struct TitleGenerationRequest: Encodable {
    let messages: [ChatRequestMessage]

    init(messages: [ChatMessage]) {
        self.messages = ChatMessage.providerMessages(from: messages).map(ChatRequestMessage.init)
    }
}

public struct TitleGenerationResponse: Codable {
    public let title: String
}

public struct UpdateConversationRequest: Encodable {
    let title: String?
    let messages: [ConversationUpdateMessage]?
    let parentConversationId: String?
    let parentMessageId: String?

    enum CodingKeys: String, CodingKey {
        case title, messages
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
        self.messages = messages?.map(ConversationUpdateMessage.init)
        self.parentConversationId = parentConversationId
        self.parentMessageId = parentMessageId
    }
}

public struct UpdateConversationResponse: Codable {
    public let success: Bool
    public let message: String?
    public let data: ConversationData?

    public struct ConversationData: Codable {
        public let id: String
        public let title: String
        public let updatedAt: String
    }
}

public struct ConversationListResponse: Codable {
    public let conversations: [ConversationSummary]
    public let totalPages: Int
    public let pageNumber: Int
    public let pageSize: Int

    public struct ConversationSummary: Codable, Identifiable {
        public let id: String
        public let title: String?
        public let createdAt: String
        public let updatedAt: String
        public let model: String?
        public let isArchived: Bool
        public let userId: Int?
        public let shareId: String?
        public let messages: [String]
        public let lastMessageAt: String?
        public let messageCount: Int?

        enum CodingKeys: String, CodingKey {
            case id, title, model, messages
            case createdAt = "created_at"
            case updatedAt = "updated_at"
            case isArchived = "is_archived"
            case userId = "user_id"
            case shareId = "share_id"
            case lastMessageAt = "last_message_at"
            case messageCount = "message_count"
        }

        public init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            id = try container.decode(String.self, forKey: .id)
            title = try container.decodeIfPresent(String.self, forKey: .title)
            createdAt = try container.decode(String.self, forKey: .createdAt)
            updatedAt = try container.decode(String.self, forKey: .updatedAt)
            model = try container.decodeIfPresent(String.self, forKey: .model)
            isArchived = try container.decodeFlexibleBool(forKey: .isArchived)
            userId = try container.decodeFlexibleIntIfPresent(forKey: .userId)
            shareId = try container.decodeIfPresent(String.self, forKey: .shareId)
            messages = try container.decodeIfPresent([String].self, forKey: .messages) ?? []
            lastMessageAt = try container.decodeIfPresent(String.self, forKey: .lastMessageAt)
            messageCount = try container.decodeIfPresent(Int.self, forKey: .messageCount)
        }
    }
}

public struct ConversationDetailResponse: Codable {
    public let id: String
    public let title: String?
    public let createdAt: String
    public let updatedAt: String
    public let model: String?
    public let isArchived: Bool
    public let messages: [ChatMessage]
    public let shareId: String?
    public let lastMessageAt: String?
    public let messageCount: Int?
    public let latestRun: ChatRun?
    public let hasMoreMessages: Bool
    public let oldestMessageId: String?

    enum CodingKeys: String, CodingKey {
        case id, title, model, messages
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case isArchived = "is_archived"
        case shareId = "share_id"
        case lastMessageAt = "last_message_at"
        case messageCount = "message_count"
        case latestRun = "latest_run"
        case hasMoreMessages = "has_more_messages"
        case oldestMessageId = "oldest_message_id"
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        createdAt = try container.decode(String.self, forKey: .createdAt)
        updatedAt = try container.decode(String.self, forKey: .updatedAt)
        model = try container.decodeIfPresent(String.self, forKey: .model)
        isArchived = try container.decodeFlexibleBool(forKey: .isArchived)
        messages = try container.decodeIfPresent([ChatMessage].self, forKey: .messages) ?? []
        shareId = try container.decodeIfPresent(String.self, forKey: .shareId)
        lastMessageAt = try container.decodeIfPresent(String.self, forKey: .lastMessageAt)
        messageCount = try container.decodeIfPresent(Int.self, forKey: .messageCount)
        latestRun = try container.decodeIfPresent(ChatRun.self, forKey: .latestRun)
        hasMoreMessages = try container.decodeIfPresent(Bool.self, forKey: .hasMoreMessages) ?? false
        oldestMessageId = try container.decodeIfPresent(String.self, forKey: .oldestMessageId)
    }
}

public struct ConversationMessagePageResponse: Codable {
    public let messages: [ChatMessage]
    public let hasMore: Bool
    public let oldestMessageId: String?

    enum CodingKeys: String, CodingKey {
        case messages
        case hasMore = "has_more"
        case oldestMessageId = "oldest_message_id"
    }

    public init(messages: [ChatMessage], hasMore: Bool, oldestMessageId: String?) {
        self.messages = messages
        self.hasMore = hasMore
        self.oldestMessageId = oldestMessageId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        messages = try container.decodeIfPresent([ChatMessage].self, forKey: .messages) ?? []
        hasMore = try container.decodeIfPresent(Bool.self, forKey: .hasMore) ?? false
        oldestMessageId = try container.decodeIfPresent(String.self, forKey: .oldestMessageId)
    }
}
