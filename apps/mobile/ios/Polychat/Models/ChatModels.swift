import Foundation

public struct ChatMessage: Codable, Identifiable, Equatable {
    public static func == (lhs: ChatMessage, rhs: ChatMessage) -> Bool {
        lhs.id == rhs.id
    }

    public let id: UUID
    public let role: String
    public let content: String
    public var artifacts: [Artifact]?

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(role, forKey: .role)
        try container.encode(content, forKey: .content)
    }

    public var isFromCurrentUser: Bool {
        role == "user"
    }

    public init(
        id: UUID = UUID(),
        role: String,
        content: String,
        artifacts: [Artifact]? = nil
    ) {
        self.id = id
        self.role = role
        self.content = content
        self.artifacts = artifacts
    }

    enum CodingKeys: String, CodingKey {
        case role, content
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        role = try container.decode(String.self, forKey: .role)
        content = try container.decode(String.self, forKey: .content)
        id = UUID()
        artifacts = nil
    }

    public mutating func extractArtifacts() {
        let codeBlockPattern = "```(\\w*)\\n([\\s\\S]*?)```"
        guard let regex = try? NSRegularExpression(pattern: codeBlockPattern, options: []) else {
            return
        }

        let nsContent = content as NSString
        let matches = regex.matches(in: content, options: [], range: NSRange(location: 0, length: nsContent.length))

        var extractedArtifacts: [Artifact] = []

        for match in matches {
            let languageRange = match.range(at: 1)
            let codeRange = match.range(at: 2)

            let language = languageRange.location != NSNotFound ? nsContent.substring(with: languageRange) : "text"
            let code = codeRange.location != NSNotFound ? nsContent.substring(with: codeRange) : ""

            let artifact = Artifact(
                id: UUID().uuidString,
                type: .code,
                title: "\(language.isEmpty ? "Code" : language.capitalized) Block",
                content: code,
                language: language.isEmpty ? nil : language
            )
            extractedArtifacts.append(artifact)
        }

        if !extractedArtifacts.isEmpty {
            self.artifacts = extractedArtifacts
        }
    }
}

public struct Artifact: Codable, Identifiable, Equatable {
    public let id: String
    public let type: ArtifactType
    public let title: String
    public let content: String
    public let language: String?
    public let url: String?

    public enum ArtifactType: String, Codable {
        case code
        case image
        case text
        case markdown
    }

    public init(id: String, type: ArtifactType, title: String, content: String, language: String? = nil, url: String? = nil) {
        self.id = id
        self.type = type
        self.title = title
        self.content = content
        self.language = language
        self.url = url
    }
}

public struct ChatCompletionResponse: Codable {
    public let choices: [ChatChoice]

    public struct ChatChoice: Codable {
        public let message: ChatMessage
    }
}

public struct ChatCompletionRequest: Codable {
    let messages: [ChatMessage]
    let model: String
    let platform: String
    let store: Bool
    let completionId: String?

    enum CodingKeys: String, CodingKey {
        case messages, model, platform, store
        case completionId = "completion_id"
    }

    public init(messages: [ChatMessage], model: String, store: Bool = true, completionId: String? = nil) {
        self.messages = messages
        self.model = model
        self.platform = "mobile"
        self.store = store
        self.completionId = completionId
    }
}

public struct TranscriptionResponse: Codable {
    let text: String
}

public struct ErrorResponse: Codable {
    let error: String
}

public struct ModelConfigItem: Codable, Identifiable {
    public var id: String = "" // Will be set from dictionary key
    public let name: String?
    public let provider: String
    public let description: String?
    public let strengths: [String]?
    public let contextWindow: Int?
    public let pricing: ModelPricing?
    public let type: [String]?
    public let supportsFunctions: Bool?
    public let multimodal: Bool?
    
    public struct ModelPricing: Codable {
        public let costPer1kInputTokens: Double?
        public let costPer1kOutputTokens: Double?
    }
    
    // Custom coding keys that excludes 'id' since it comes from the dictionary key
    enum CodingKeys: String, CodingKey {
        case name, provider, description, strengths, contextWindow, pricing, type, supportsFunctions, multimodal
    }
    
    public init(id: String, name: String?, provider: String, description: String?, strengths: [String]?, contextWindow: Int?, pricing: ModelPricing?, type: [String]?, supportsFunctions: Bool?, multimodal: Bool?) {
        self.id = id
        self.name = name
        self.provider = provider
        self.description = description
        self.strengths = strengths
        self.contextWindow = contextWindow
        self.pricing = pricing
        self.type = type
        self.supportsFunctions = supportsFunctions
        self.multimodal = multimodal
    }
}

public struct ModelsResponse: Codable {
    public let success: Bool
    public let message: String?
    public let data: [String: ModelConfigItem]
}

public struct TitleGenerationRequest: Codable {
    let messages: [ChatMessage]
}

public struct TitleGenerationResponse: Codable {
    public let success: Bool
    public let message: String?
    public let data: TitleData?
    
    public struct TitleData: Codable {
        public let title: String
    }
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

// Conversation List Response
public struct ConversationListResponse: Codable {
    public let data: [ConversationSummary]
    public let total: Int
    public let page: Int
    public let limit: Int
    public let pages: Int

    public struct ConversationSummary: Codable, Identifiable {
        public let id: String
        public let title: String?
        public let createdAt: String
        public let updatedAt: String
        public let model: String?
        public let isArchived: Bool
        public let userId: String
        public let shareId: String?

        enum CodingKeys: String, CodingKey {
            case id, title, model
            case createdAt = "created_at"
            case updatedAt = "updated_at"
            case isArchived = "is_archived"
            case userId = "user_id"
            case shareId = "share_id"
        }
    }
}

// Conversation Detail Response
public struct ConversationDetailResponse: Codable {
    public let id: String
    public let title: String?
    public let createdAt: String
    public let updatedAt: String
    public let model: String?
    public let isArchived: Bool
    public let messages: [ChatMessage]

    enum CodingKeys: String, CodingKey {
        case id, title, model, messages
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case isArchived = "is_archived"
    }
}

// Chat Settings
public struct ChatSettings: Codable, Equatable {
    public var temperature: Double
    public var topP: Double
    public var maxTokens: Int?
    public var responseMode: ResponseMode

    public enum ResponseMode: String, Codable, CaseIterable {
        case normal = "normal"
        case concise = "concise"
        case explanatory = "explanatory"
        case formal = "formal"

        public var displayName: String {
            rawValue.capitalized
        }

        public var description: String {
            switch self {
            case .normal:
                return "Balanced responses"
            case .concise:
                return "Brief and to the point"
            case .explanatory:
                return "Detailed explanations"
            case .formal:
                return "Professional tone"
            }
        }
    }

    public static let `default` = ChatSettings(
        temperature: 0.7,
        topP: 0.9,
        maxTokens: nil,
        responseMode: .normal
    )

    public init(temperature: Double = 0.7, topP: Double = 0.9, maxTokens: Int? = nil, responseMode: ResponseMode = .normal) {
        self.temperature = temperature
        self.topP = topP
        self.maxTokens = maxTokens
        self.responseMode = responseMode
    }
}
