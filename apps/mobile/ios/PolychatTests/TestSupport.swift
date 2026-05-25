import Foundation
import Testing
@testable import Polychat

enum TestFailure: Error {
    case unexpectedCall
    case forced
}

func makeModel(
    id: String,
    name: String? = nil,
    provider: String = "openai",
    description: String? = nil,
    strengths: [String]? = nil,
    contextWindow: Int? = nil,
    inputModalities: [String] = ["text"],
    outputModalities: [String]? = ["text"],
    supportsFunctions: Bool? = nil,
    multimodal: Bool? = nil,
    isFeatured: Bool? = true,
    isDeprecated: Bool? = false
) -> ModelConfigItem {
    ModelConfigItem(
        id: id,
        name: name,
        provider: provider,
        description: description,
        strengths: strengths,
        contextWindow: contextWindow,
        pricing: nil,
        modalities: ModelConfigItem.ModelModalities(input: inputModalities, output: outputModalities),
        supportsFunctions: supportsFunctions,
        multimodal: multimodal,
        isFeatured: isFeatured,
        isDeprecated: isDeprecated
    )
}

func makeConversation(
    id: String,
    title: String = "Conversation",
    createdAt: Date = Date(timeIntervalSince1970: 0),
    lastMessageAt: Date? = nil,
    messages: [ChatMessage] = [],
    isLoadedFromAPI: Bool = false
) -> Conversation {
    Conversation(
        id: id,
        title: title,
        messages: messages,
        createdAt: createdAt,
        modelId: nil,
        isLoadedFromAPI: isLoadedFromAPI,
        lastMessageAt: lastMessageAt,
        messageCount: messages.count
    )
}

func makeIsolatedUserDefaults() throws -> UserDefaults {
    let suiteName = "PolychatTests.\(UUID().uuidString)"
    let defaults = try #require(UserDefaults(suiteName: suiteName))
    defaults.removePersistentDomain(forName: suiteName)
    return defaults
}

final class ModelsAPIClientStub: ModelsAPIClient {
    var result: Result<ModelsResponse, Error>

    init(result: Result<ModelsResponse, Error>) {
        self.result = result
    }

    func fetchModels() async throws -> ModelsResponse {
        try result.get()
    }
}

final class ToolsAPIClientStub: ToolsAPIClient {
    var result: Result<[ToolDefinition], Error>

    init(result: Result<[ToolDefinition], Error>) {
        self.result = result
    }

    func fetchTools() async throws -> [ToolDefinition] {
        try result.get()
    }
}

final class ConversationAPIClientStub: ConversationAPIClient {
    var streamEvents: [ChatStreamEvent] = []
    var streamedMessages: [ChatMessage] = []
    var streamedModelId: String?
    var streamedCompletionId: String?
    var generatedTitle = "Generated title"

    func fetchConversations(limit: Int, page: Int, includeArchived: Bool) async throws -> ConversationListResponse {
        throw TestFailure.unexpectedCall
    }

    func fetchConversation(id: String, refreshPending: Bool) async throws -> ConversationDetailResponse {
        throw TestFailure.unexpectedCall
    }

    func streamChatCompletion(
        messages: [ChatMessage],
        modelId: String?,
        provider: String?,
        completionId: String?,
        settings: ChatSettings?
    ) -> AsyncThrowingStream<ChatStreamEvent, Error> {
        streamedMessages = messages
        streamedModelId = modelId
        streamedCompletionId = completionId

        return AsyncThrowingStream { continuation in
            for event in streamEvents {
                continuation.yield(event)
            }
            continuation.finish()
        }
    }

    func generateTitle(conversationId: String, messages: [ChatMessage]) async throws -> TitleGenerationResponse {
        TitleGenerationResponse(title: generatedTitle)
    }

    func updateConversation(id: String, title: String) async throws {}

    func deleteConversation(id: String) async throws {}
}
