import Foundation

protocol ModelsAPIClient {
    func fetchModels() async throws -> ModelsResponse
    func fetchModelTiers() async throws -> ModelTiersResponse
    func fetchMachines() async throws -> [MachineRecord]
}

extension ModelsAPIClient {
    func fetchMachines() async throws -> [MachineRecord] { [] }
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
    func fetchConversations(limit: Int, after: String?, includeArchived: Bool) async throws -> ConversationListResponse
    func fetchConversation(
        id: String,
        refreshPending: Bool
    ) async throws -> ConversationDetailResponse
    func fetchConversationMessages(id: String, before: String, limit: Int) async throws -> ConversationMessagePageResponse
    func streamResponse(
        messages: [ChatMessage],
        modelId: String?,
        provider: String?,
        conversationId: String?,
        settings: ChatSettings?,
        idempotencyKey: String,
        modelTier: String?,
        computeSite: String,
        agentTeammateId: String?
    ) -> AsyncThrowingStream<ChatStreamEvent, Error>
    func fetchResponseSnapshot(id: String) async throws -> ResponseSnapshot
    func fetchResponseEvents(id: String, after: Int, limit: Int) async throws -> ResponseReplayResponse
    func cancelResponse(id: String, expectedAttempt: Int, idempotencyKey: String) async throws -> PlatformResponse
    func fetchConnectorApproval(id: String) async throws -> ConnectorOperationApproval
    func resolveConnectorApproval(id: String, resolution: String) async throws -> ConnectorApprovalResolution
    func streamApprovedConnectorOperation(
        messages: [ChatMessage],
        modelId: String?,
        provider: String?,
        conversationId: String,
        settings: ChatSettings?,
        approvalId: String,
        idempotencyKey: String,
        modelTier: String?,
        computeSite: String
    ) -> AsyncThrowingStream<ChatStreamEvent, Error>
    func fetchProjectTask(projectId: String, taskId: String) async throws -> ProjectTaskDetailResponse
    func answerProjectTaskQuestions(
        projectId: String,
        taskId: String,
        interactionId: String,
        answers: [UserQuestionAnswer]
    ) async throws -> ProjectTaskResponse
    func resolveProjectTaskApproval(
        projectId: String,
        taskId: String,
        interactionId: String,
        resolution: String
    ) async throws -> ProjectTaskResponse
    func generateTitle(conversationId: String, messages: [ChatMessage]) async throws -> TitleGenerationResponse
    func reactToItem(conversationId: String, itemId: String, emoji: String, remove: Bool) async throws -> ItemReactionEnvelope
    func updateConversation(id: String, title: String?, messages: [ChatMessage]?, parentConversationId: String?, parentMessageId: String?) async throws
    func deleteConversation(id: String) async throws
}

protocol TaskNotificationsAPIClient {
    func fetchTaskInbox() async throws -> TaskInboxResponse
    func fetchTaskNotificationSettings() async throws -> TaskNotificationSettings
    func updateTaskNotificationPreferences(
        _ request: UpdateTaskNotificationPreferencesRequest
    ) async throws -> TaskNotificationSettings
    func updateTaskInbox(itemIds: [String], action: String) async throws -> TaskInboxMutationResponse
}

protocol OutputRevisionsAPIClient {
    func fetchOutputHistory(id: String) async throws -> OutputHistoryResponse
    func restoreOutputRevision(
        outputId: String,
        revision: Int,
        expectedRevision: Int
    ) async throws -> RestoredOutputResponse
}

protocol WorkAPIClient {
    func fetchWorkAttention(limit: Int) async throws -> WorkAttentionResponse
    func fetchSandboxRun(id: String) async throws -> SandboxRunDetail
    func fetchSandboxRunEvents(id: String) async throws -> SandboxRunEventsResponse
    func fetchSandboxRunInstructions(id: String) async throws -> SandboxRunInstructionsResponse
    func fetchSandboxRunControl(id: String) async throws -> SandboxRunControl
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
        try await fetchConversations(limit: 50, after: nil, includeArchived: false)
    }

    func fetchConversation(id: String) async throws -> ConversationDetailResponse {
        try await fetchConversation(id: id, refreshPending: true)
    }

    func fetchConversationMessages(id: String, before: String) async throws -> ConversationMessagePageResponse {
        try await fetchConversationMessages(id: id, before: before, limit: 100)
    }

    func cancelResponse(id: String, expectedAttempt: Int) async throws -> PlatformResponse {
        try await cancelResponse(id: id, expectedAttempt: expectedAttempt, idempotencyKey: UUID().uuidString)
    }

    func fetchResponseEvents(id: String, after: Int) async throws -> ResponseReplayResponse {
        try await fetchResponseEvents(id: id, after: after, limit: 100)
    }

}

protocol AgeGateAPIClient {
    func fetchAgeGate() async throws -> AgeGateResponse
    func confirmAge(birthDate: String) async throws -> AgeGateResponse
}

extension APIClient: ModelsAPIClient, RecipesAPIClient, ConversationAPIClient, TaskNotificationsAPIClient, OutputRevisionsAPIClient, WorkAPIClient, AgeGateAPIClient {}
