import Foundation

public struct ModelTiersResponse: Codable {
    public let runtimes: [String: ModelTierLineup]
    public let defaultTier: String

    enum CodingKeys: String, CodingKey {
        case runtimes
        case defaultTier = "default"
    }
}

public struct MachineRecord: Codable, Identifiable {
    public let machineId: String
    public let label: String
    public let platform: String
    public let appVersion: String
    public let runtimes: [MachineRuntime]
    public let capabilities: [String]
    public let lastSeenAt: String
    public let online: Bool

    public var id: String { machineId }

}

public struct MachineRuntime: Codable {
    public let kind: String
    public let vendor: String
    public let readiness: MachineReadiness
    public let models: [MachineModel]
}

public struct MachineReadiness: Codable {
    public let status: String
    public let checkedAt: String
    public let version: String?
    public let detail: String?
}

public struct MachineModel: Codable {
    public let nativeId: String
    public let displayName: String
    public let contextTokens: Int?
    public let parameterSizeBytes: Int?
    public let capabilities: MachineModelCapabilities
    public let loaded: Bool
}

struct MachineRunRequest: Encodable {
    let id: String
    let conversationId: String
    let vendor: String
    let nativeModelId: String
    let messages: [ChatMessage]
}

struct MachineRunSnapshot: Decodable {
    let id: String
    let state: String
    let text: String
    let error: String?
}

public struct MachineModelCapabilities: Codable {
    public let tools: Bool
    public let vision: Bool
    public let thinking: Bool
}


public struct ModelTierLineup: Codable {
    public let low: ModelTierRoleSelection
    public let medium: ModelTierRoleSelection
    public let high: ModelTierRoleSelection
    public let ultra: ModelTierRoleSelection

    func modelId(for tier: String) -> String? {
        switch tier {
        case "low": return low.agent?.id
        case "medium": return medium.agent?.id
        case "high": return high.agent?.id
        case "ultra": return ultra.agent?.id
        default: return nil
        }
    }
}

public struct ModelTierRoleSelection: Codable {
    public let agent: ResolvedModelTier?
    public let coding: ResolvedModelTier?
}

public struct ResolvedModelTier: Codable {
    public let id: String
    public let name: String
    public let provider: String
    public let effort: String?
}

public struct RunProvenance: Codable, Equatable {
    public let site: String
    public let model: String
    public let vendor: String
    public let machineId: String?
}

public struct ResponseUsage: Codable, Equatable {
    public let protocolVersion: Int
    public let runId: String
    public let currentAttempt: Int
    public let measurement: String
    public let reservation: ResponseUsageReservation?
    public let consumption: ResponseUsageConsumption
    public let attempts: [ResponseUsageAttempt]
    public let settlement: ResponseUsageSettlement
}

public struct ResponseUsageReservation: Codable, Equatable {
    public let creditMicros: Int
    public let status: String
    public let expiresAt: String?
    public let createdAt: String
    public let updatedAt: String?
}

public struct ResponseUsageConsumption: Codable, Equatable {
    public let status: String
    public let eventCount: Int
    public let costMicros: Int?
    public let creditMicros: Int?
    public let estimatedPriceEventCount: Int
    public let bySource: [ResponseUsageSourceSummary]
}

public struct ResponseUsageSourceSummary: Codable, Equatable {
    public let source: String
    public let eventCount: Int
    public let costMicros: Int
    public let creditMicros: Int
    public let estimatedPriceEventCount: Int
}

public struct ResponseUsageAttempt: Codable, Equatable {
    public let attempt: Int
    public let measurement: String
    public let inputTokens: Int?
    public let eventCount: Int
    public let costMicros: Int?
    public let creditMicros: Int?
    public let estimatedPriceEventCount: Int
}

public struct ResponseUsageSettlement: Codable, Equatable {
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
    public let supportsToolCalls: Bool?
    public let multimodal: Bool?
    public let isFeatured: Bool?
    public let deprecated: Bool?
    public let isDefault: Bool?
    public let isExecutable: Bool?
    public let runsOn: String?
    public let machineId: String?
    public let isPlatformEnabled: Bool?
    public let isFree: Bool?
    public let isByokEnabled: Bool?
    public let readiness: ModelReadiness?
    public let status: String?
    public let supportsAttachments: Bool?
    public let supportsDocuments: Bool?
    public let supportsAudio: Bool?
    public let supportsImageEdits: Bool?
    public let supportsResponseFormat: Bool?
    public let supportsRealtimeSession: Bool?
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
    
    enum CodingKeys: String, CodingKey, CaseIterable {
        case id, name, provider, description, strengths, contextWindow, pricing, modalities, supportsToolCalls
        case multimodal, isFeatured, isDefault, isExecutable, runsOn, machineId, isPlatformEnabled, isFree, isByokEnabled
        case readiness, status, deprecated
        case reasoningConfig, supportedServiceTiers, serviceTierMultipliers
        case supportsAttachments, supportsDocuments, supportsAudio, supportsImageEdits, supportsResponseFormat
        case supportsRealtimeSession
    }

    static let ignoredKeys: Set<String> = [
        "apiOperation",
        "artificialAnalysis",
        "card",
        "contextComplexity",
        "costPer1kInputTokens",
        "costPer1kOutputTokens",
        "costPer1kReasoningTokens",
        "deprecationMessage",
        "family",
        "hiddenFromDefaultList",
        "hostedToolCosts",
        "inputFormat",
        "knowledgeCutoffDate",
        "lastUpdated",
        "matchingModel",
        "maxTokens",
        "openWeights",
        "releaseDate",
        "reliability",
        "replacementModel",
        "speed",
        "supportsCodeExecution",
        "supportsFim",
        "supportsFrequencyPenalty",
        "supportsParallelToolCalls",
        "supportsPresencePenalty",
        "supportsSearchGrounding",
        "supportsStreaming",
        "supportsTemperature",
        "supportsToolChoice",
        "supportsTopP",
        "supportsUrlContext",
        "supportsWebFetch"
    ]
    
    public init(
        id: String,
        name: String?,
        provider: String,
        description: String?,
        strengths: [String]?,
        contextWindow: Int?,
        pricing: ModelPricing?,
        modalities: ModelModalities?,
        supportsToolCalls: Bool?,
        multimodal: Bool?,
        isFeatured: Bool? = nil,
        deprecated: Bool? = nil,
        isDefault: Bool? = nil,
        isExecutable: Bool? = nil,
        runsOn: String? = nil,
        machineId: String? = nil,
        isPlatformEnabled: Bool? = nil,
        isFree: Bool? = nil,
        isByokEnabled: Bool? = nil,
        readiness: ModelReadiness? = nil,
        status: String? = nil,
        supportsAttachments: Bool? = nil,
        supportsDocuments: Bool? = nil,
        supportsAudio: Bool? = nil,
        supportsImageEdits: Bool? = nil,
        supportsResponseFormat: Bool? = nil,
        supportsRealtimeSession: Bool? = nil,
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
        self.supportsToolCalls = supportsToolCalls
        self.multimodal = multimodal
        self.isFeatured = isFeatured
        self.deprecated = deprecated
        self.isDefault = isDefault
        self.isExecutable = isExecutable
        self.runsOn = runsOn
        self.machineId = machineId
        self.isPlatformEnabled = isPlatformEnabled
        self.isFree = isFree
        self.isByokEnabled = isByokEnabled
        self.readiness = readiness
        self.status = status
        self.supportsAttachments = supportsAttachments
        self.supportsDocuments = supportsDocuments
        self.supportsAudio = supportsAudio
        self.supportsImageEdits = supportsImageEdits
        self.supportsResponseFormat = supportsResponseFormat
        self.supportsRealtimeSession = supportsRealtimeSession
        self.reasoningConfig = reasoningConfig
        self.supportedServiceTiers = supportedServiceTiers
        self.serviceTierMultipliers = serviceTierMultipliers
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        id = try container.decodeIfPresent(String.self, forKey: .id) ?? ""
        name = try container.decodeIfPresent(String.self, forKey: .name)
        provider = try container.decode(String.self, forKey: .provider)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        strengths = try container.decodeIfPresent([String].self, forKey: .strengths)
        contextWindow = try container.decodeIfPresent(Int.self, forKey: .contextWindow)
        pricing = try container.decodeIfPresent(ModelPricing.self, forKey: .pricing)
        modalities = try container.decodeIfPresent(ModelModalities.self, forKey: .modalities)
        supportsToolCalls = try container.decodeIfPresent(Bool.self, forKey: .supportsToolCalls)
        multimodal = try container.decodeIfPresent(Bool.self, forKey: .multimodal)
        isFeatured = try container.decodeIfPresent(Bool.self, forKey: .isFeatured)
        deprecated = try container.decodeIfPresent(Bool.self, forKey: .deprecated)
        isDefault = try container.decodeIfPresent(Bool.self, forKey: .isDefault)
        isExecutable = try container.decodeIfPresent(Bool.self, forKey: .isExecutable)
        runsOn = try container.decodeIfPresent(String.self, forKey: .runsOn)
        machineId = try container.decodeIfPresent(String.self, forKey: .machineId)
        isPlatformEnabled = try container.decodeIfPresent(Bool.self, forKey: .isPlatformEnabled)
        isFree = try container.decodeIfPresent(Bool.self, forKey: .isFree)
        isByokEnabled = try container.decodeIfPresent(Bool.self, forKey: .isByokEnabled)
        readiness = try container.decodeIfPresent(ModelReadiness.self, forKey: .readiness)
        status = try container.decodeIfPresent(String.self, forKey: .status)
        supportsAttachments = try container.decodeIfPresent(Bool.self, forKey: .supportsAttachments)
        supportsDocuments = try container.decodeIfPresent(Bool.self, forKey: .supportsDocuments)
        supportsAudio = try container.decodeIfPresent(Bool.self, forKey: .supportsAudio)
        supportsImageEdits = try container.decodeIfPresent(Bool.self, forKey: .supportsImageEdits)
        supportsResponseFormat = try container.decodeIfPresent(Bool.self, forKey: .supportsResponseFormat)
        supportsRealtimeSession = try container.decodeIfPresent(Bool.self, forKey: .supportsRealtimeSession)
        reasoningConfig = try container.decodeIfPresent(ReasoningConfig.self, forKey: .reasoningConfig)
        supportedServiceTiers = try container.decodeIfPresent([String].self, forKey: .supportedServiceTiers)
        serviceTierMultipliers = try container.decodeIfPresent([String: Double].self, forKey: .serviceTierMultipliers)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)

        if !id.isEmpty {
            try container.encode(id, forKey: .id)
        }
        try container.encodeIfPresent(name, forKey: .name)
        try container.encode(provider, forKey: .provider)
        try container.encodeIfPresent(description, forKey: .description)
        try container.encodeIfPresent(strengths, forKey: .strengths)
        try container.encodeIfPresent(contextWindow, forKey: .contextWindow)
        try container.encodeIfPresent(pricing, forKey: .pricing)
        try container.encodeIfPresent(modalities, forKey: .modalities)
        try container.encodeIfPresent(supportsToolCalls, forKey: .supportsToolCalls)
        try container.encodeIfPresent(multimodal, forKey: .multimodal)
        try container.encodeIfPresent(isFeatured, forKey: .isFeatured)
        try container.encodeIfPresent(deprecated, forKey: .deprecated)
        try container.encodeIfPresent(isDefault, forKey: .isDefault)
        try container.encodeIfPresent(isExecutable, forKey: .isExecutable)
        try container.encodeIfPresent(runsOn, forKey: .runsOn)
        try container.encodeIfPresent(machineId, forKey: .machineId)
        try container.encodeIfPresent(isPlatformEnabled, forKey: .isPlatformEnabled)
        try container.encodeIfPresent(isFree, forKey: .isFree)
        try container.encodeIfPresent(isByokEnabled, forKey: .isByokEnabled)
        try container.encodeIfPresent(readiness, forKey: .readiness)
        try container.encodeIfPresent(status, forKey: .status)
        try container.encodeIfPresent(supportsAttachments, forKey: .supportsAttachments)
        try container.encodeIfPresent(supportsDocuments, forKey: .supportsDocuments)
        try container.encodeIfPresent(supportsAudio, forKey: .supportsAudio)
        try container.encodeIfPresent(supportsImageEdits, forKey: .supportsImageEdits)
        try container.encodeIfPresent(supportsResponseFormat, forKey: .supportsResponseFormat)
        try container.encodeIfPresent(supportsRealtimeSession, forKey: .supportsRealtimeSession)
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

    private static let knownReasonCodes: Set<String> = [
        "ready",
        "account_required",
        "plan_required",
        "credential_required",
        "permission_denied",
        "provider_unavailable",
        "model_unavailable",
        "attachment_incompatible",
        "active_run",
        "pending_interaction",
        "check_failed",
        "no_match",
        "runtime_not_configured",
        "runtime_unreachable",
        "runtime_model_missing",
        "runtime_model_loading",
        "machine_offline",
        "desktop_required"
    ]

    private static let knownActionKinds: Set<String> = [
        "retry",
        "sign_in",
        "upgrade",
        "configure_provider",
        "choose_model",
        "remove_attachment",
        "resolve_interaction",
        "start_new_conversation",
        "open_runtimes",
        "install_desktop",
        "open_on_machine"
    ]

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

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        protocolVersion = try container.decode(Int.self, forKey: .protocolVersion)
        state = try container.decode(String.self, forKey: .state)
        let rawReasonCode = try container.decode(String.self, forKey: .reasonCode)
        reasonCode = Self.knownReasonCodes.contains(rawReasonCode) ? rawReasonCode : "check_failed"
        reason = try container.decode(String.self, forKey: .reason)
        checkedAt = try container.decode(String.self, forKey: .checkedAt)
        expiresAt = try container.decode(String.self, forKey: .expiresAt)

        if let decodedAction = try? container.decode(ModelReadinessAction.self, forKey: .action),
           Self.knownActionKinds.contains(decodedAction.kind),
           Self.knownReasonCodes.contains(rawReasonCode) {
            action = decodedAction
        } else {
            action = nil
        }
    }

    private enum CodingKeys: String, CodingKey {
        case protocolVersion
        case state
        case reasonCode
        case reason
        case checkedAt
        case expiresAt
        case action
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

    enum CodingKeys: String, CodingKey {
        case categories, filters
        case recipes = "data"
    }
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

