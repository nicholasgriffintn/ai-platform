import Foundation

public struct ChatMessage: Codable, Identifiable {
    public let id: UUID
    public let role: String
    public let content: String

    public init(id: UUID = UUID(), role: String, content: String) {
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
    let model: String = "mistral-small"
}

public struct TranscriptionResponse: Codable {
    let text: String
}

public struct ErrorResponse: Codable {
    let error: String
}
