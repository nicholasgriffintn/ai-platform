import Foundation

public struct ChatMessage: Codable, Identifiable, Equatable {
    public static func == (lhs: ChatMessage, rhs: ChatMessage) -> Bool {
        lhs.id == rhs.id
    }
    
    public let id: UUID
    public let role: String
    public let content: String
    
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
        content: String
    ) {
        self.id = id
        self.role = role
        self.content = content
    }

    enum CodingKeys: String, CodingKey {
        case role, content
    }
    
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        role = try container.decode(String.self, forKey: .role)
        content = try container.decode(String.self, forKey: .content)
        id = UUID()
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
    
    public init(messages: [ChatMessage], model: String) {
        self.messages = messages
        self.model = model
		self.platform = "mobile"
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
