import Foundation

protocol ModelsAPIClient {
    func fetchModels() async throws -> ModelsResponse
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
    func fetchConversation(
        id: String,
        refreshPending: Bool,
        recovery: TurnRecoveryAttemptContext?
    ) async throws -> ConversationDetailResponse
    func fetchConversationMessages(id: String, before: String, limit: Int) async throws -> ConversationMessagePageResponse
    func streamChatCompletion(
        messages: [ChatMessage],
        modelId: String?,
        provider: String?,
        completionId: String?,
        settings: ChatSettings?,
        commandId: String
    ) -> AsyncThrowingStream<ChatStreamEvent, Error>
    func fetchChatRun(
        id: String,
        recovery: TurnRecoveryAttemptContext?
    ) async throws -> ChatRunRecoveryResponse
    func fetchChatRunSnapshot(id: String) async throws -> ChatRunSnapshotResponse
    func fetchChatRunEvents(id: String, after: Int, limit: Int) async throws -> ChatRunReplayResponse
    func fetchChatRunCommand(id: String) async throws -> ChatRunCommandReceipt
    func cancelChatRun(id: String, expectedAttempt: Int, commandId: String) async throws -> ChatRunCommandReceipt
    func fetchConnectorApproval(id: String) async throws -> ConnectorOperationApproval
    func resolveConnectorApproval(id: String, resolution: String) async throws -> ConnectorApprovalResolution
    func streamApprovedConnectorOperation(
        messages: [ChatMessage],
        modelId: String?,
        provider: String?,
        completionId: String,
        settings: ChatSettings?,
        approvalId: String,
        commandId: String
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
        try await fetchConversations(limit: 50, page: 1, includeArchived: false)
    }

    func fetchConversation(id: String) async throws -> ConversationDetailResponse {
        try await fetchConversation(id: id, refreshPending: true, recovery: nil)
    }

    func fetchConversation(
        id: String,
        refreshPending: Bool
    ) async throws -> ConversationDetailResponse {
        try await fetchConversation(id: id, refreshPending: refreshPending, recovery: nil)
    }

    func fetchConversationMessages(id: String, before: String) async throws -> ConversationMessagePageResponse {
        try await fetchConversationMessages(id: id, before: before, limit: 100)
    }

    func cancelChatRun(id: String, expectedAttempt: Int) async throws -> ChatRunCommandReceipt {
        try await cancelChatRun(id: id, expectedAttempt: expectedAttempt, commandId: UUID().uuidString)
    }

    func fetchChatRunEvents(id: String, after: Int) async throws -> ChatRunReplayResponse {
        try await fetchChatRunEvents(id: id, after: after, limit: 100)
    }

    func fetchChatRun(id: String) async throws -> ChatRunRecoveryResponse {
        try await fetchChatRun(id: id, recovery: nil)
    }
}

extension APIClient: ModelsAPIClient, RecipesAPIClient, ConversationAPIClient, TaskNotificationsAPIClient, OutputRevisionsAPIClient, WorkAPIClient {}
