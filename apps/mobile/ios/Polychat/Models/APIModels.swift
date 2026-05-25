import Foundation
public struct ChatCompletionResponse: Codable {
    public let choices: [ChatChoice]

    public struct ChatChoice: Codable {
        public let message: ChatMessage
    }
}

public struct ChatCompletionRequest: Codable {
    let messages: [ChatMessage]
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
    let useRag: Bool?
    let ragOptions: RagOptions?
    let reasoning: ReasoningSettings?
    let reasoningEffort: String?
    let verbosity: String?
    let enabledTools: [String]?

    enum CodingKeys: String, CodingKey {
        case messages, model, provider, platform, mode, store, stream, temperature, reasoning, verbosity, options
        case completionId = "completion_id"
        case topP = "top_p"
        case maxTokens = "max_tokens"
        case presencePenalty = "presence_penalty"
        case frequencyPenalty = "frequency_penalty"
        case useRag = "use_rag"
        case ragOptions = "rag_options"
        case reasoningEffort = "reasoning_effort"
        case enabledTools = "enabled_tools"
    }

    public init(
        messages: [ChatMessage],
        model: String?,
        provider: String? = nil,
        store: Bool = true,
        completionId: String? = nil,
        settings: ChatSettings? = nil,
        stream: Bool = false
    ) {
        self.messages = messages
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
        self.useRag = settings?.useRag == true ? true : nil
        self.ragOptions = settings?.useRag == true ? settings?.ragOptions : nil
        self.reasoning = settings?.reasoningEffort.map { ReasoningSettings(effort: $0.rawValue) }
        self.reasoningEffort = settings?.reasoningEffort?.rawValue
        self.verbosity = settings?.verbosity?.rawValue
        self.enabledTools = settings?.enabledTools.isEmpty == false ? settings?.enabledTools : nil
    }
}

public struct ReasoningSettings: Codable, Equatable {
    public let effort: String
}

public struct RagOptions: Codable, Equatable {
    public var topK: Int
    public var scoreThreshold: Double
    public var includeMetadata: Bool
    public var namespace: String

    public static let `default` = RagOptions(
        topK: 3,
        scoreThreshold: 0.5,
        includeMetadata: false,
        namespace: ""
    )
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
        case isFeatured, featured
        case isDeprecated, deprecated
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
        isDeprecated: Bool? = nil
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
    }
}

public typealias ModelsResponse = [String: ModelConfigItem]

public struct ToolDefinition: Codable, Identifiable, Equatable {
    public let id: String
    public let name: String
    public let description: String
    public let isDefault: Bool?
}

public struct TitleGenerationRequest: Codable {
    let messages: [ChatMessage]
}

public struct TitleGenerationResponse: Codable {
    public let title: String
}

public struct UpdateConversationRequest: Codable {
    let title: String
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

    enum CodingKeys: String, CodingKey {
        case id, title, model, messages
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case isArchived = "is_archived"
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
        messages = try container.decodeIfPresent([ChatMessage].self, forKey: .messages) ?? []
        shareId = try container.decodeIfPresent(String.self, forKey: .shareId)
        lastMessageAt = try container.decodeIfPresent(String.self, forKey: .lastMessageAt)
        messageCount = try container.decodeIfPresent(Int.self, forKey: .messageCount)
    }
}
