import Foundation

protocol ModelsAPIClient {
    func fetchModels() async throws -> ModelsResponse
}

protocol ToolsAPIClient {
    func fetchTools() async throws -> [ToolDefinition]
}

protocol RecipesAPIClient {
    func fetchAssistantRecipes() async throws -> AssistantRecipesResponse
    func installAssistantRecipe(
        id: String,
        triggers: [RecipeInstallationTrigger]?,
        configuration: RecipeConfiguration?
    ) async throws -> AssistantRecipeInstallResponse
}

extension RecipesAPIClient {
    func installAssistantRecipe(id: String) async throws -> AssistantRecipeInstallResponse {
        try await installAssistantRecipe(id: id, triggers: nil, configuration: nil)
    }
}

protocol ConversationAPIClient {
    func fetchConversations(limit: Int, page: Int, includeArchived: Bool) async throws -> ConversationListResponse
    func fetchConversation(id: String, refreshPending: Bool) async throws -> ConversationDetailResponse
    func streamChatCompletion(
        messages: [ChatMessage],
        modelId: String?,
        provider: String?,
        completionId: String?,
        settings: ChatSettings?
    ) -> AsyncThrowingStream<ChatStreamEvent, Error>
    func generateTitle(conversationId: String, messages: [ChatMessage]) async throws -> TitleGenerationResponse
    func updateConversation(id: String, title: String?, messages: [ChatMessage]?, parentConversationId: String?, parentMessageId: String?) async throws
    func deleteConversation(id: String) async throws
}

extension ConversationAPIClient {
    func updateConversation(id: String, title: String) async throws {
        try await updateConversation(
            id: id,
            title: title,
            messages: nil,
            parentConversationId: nil,
            parentMessageId: nil
        )
    }

    func fetchConversations() async throws -> ConversationListResponse {
        try await fetchConversations(limit: 50, page: 1, includeArchived: false)
    }

    func fetchConversation(id: String) async throws -> ConversationDetailResponse {
        try await fetchConversation(id: id, refreshPending: true)
    }
}

extension APIClient: ModelsAPIClient, ToolsAPIClient, RecipesAPIClient, ConversationAPIClient {}
