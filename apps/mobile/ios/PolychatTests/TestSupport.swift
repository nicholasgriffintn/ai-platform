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
    isDeprecated: Bool? = false,
    isDefault: Bool? = nil,
    isExecutable: Bool? = nil,
    readiness: ModelReadiness? = nil,
    status: String? = nil
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
        isDeprecated: isDeprecated,
        isDefault: isDefault,
        isExecutable: isExecutable,
        readiness: readiness,
        status: status
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

func makeConversationDetail(id: String, messagesJSON: String) throws -> ConversationDetailResponse {
    let json = """
    {
        "id": "\(id)",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
        "is_archived": false,
        "messages": [\(messagesJSON)]
    }
    """

    return try JSONDecoder().decode(ConversationDetailResponse.self, from: Data(json.utf8))
}

func makeChatRun(
    status: String = "running",
    attempt: Int = 1,
    projectId: String? = nil,
    projectTaskId: String? = nil,
    retry: ChatRetrySnapshot? = nil
) -> ChatRun {
    ChatRun(
        protocolVersion: 1,
        id: "run-1",
        conversationId: "conversation-1",
        projectId: projectId,
        projectTaskId: projectTaskId,
        initiatorUserId: 7,
        status: status,
        attempt: attempt,
        createdAt: "2026-09-05T12:00:00.000Z",
        updatedAt: "2026-09-05T12:00:01.000Z",
        startedAt: "2026-09-05T12:00:01.000Z",
        completedAt: nil,
        terminalReason: status == "failed" ? "Provider unavailable" : nil,
        lastMessageId: nil,
        retry: retry
    )
}

func makeChatRunReceipt(run: ChatRun, commandId: String = "command-1") -> ChatRunCommandReceipt {
    ChatRunCommandReceipt(
        protocolVersion: 1,
        commandId: commandId,
        run: run,
        kind: "turn",
        acceptedAt: "2026-09-05T12:00:01.000Z",
        duplicate: false
    )
}

func makeProjectTaskControlTask(
    status: String = "blocked",
    blockedReason: String? = "awaiting_input",
    blockedDetail: String? = nil
) -> ProjectTaskControlTask {
    ProjectTaskControlTask(
        id: "task-1",
        projectId: "project-1",
        workspaceId: "workspace-1",
        objective: "Prepare the launch note",
        status: status,
        blockedReason: blockedReason,
        blockedDetail: blockedDetail,
        conversationId: "conversation-1",
        runId: "run-1"
    )
}

func makeProjectTaskInteraction(
    protocolVersion: Int = 1,
    type: String = "question",
    status: String = "pending",
    questions: [UserQuestion]? = [
        UserQuestion(
            id: "tone",
            prompt: "Which tone?",
            options: [UserQuestionOption(label: "Friendly", description: "Warm and direct.")],
            allowOther: true
        )
    ],
    toolName: String? = nil,
    reason: String? = nil,
    resolution: String? = nil,
    detail: String? = nil
) -> ProjectTaskInteraction {
    ProjectTaskInteraction(
        protocolVersion: protocolVersion,
        type: type,
        projectId: "project-1",
        taskId: "task-1",
        runId: "run-1",
        interactionId: type == "approval" ? "approval-1" : "question-1",
        status: status,
        requestedAt: "2026-09-05T12:00:00.000Z",
        resolvedAt: status == "pending" ? nil : "2026-09-05T12:01:00.000Z",
        detail: detail,
        questions: type == "question" ? questions : nil,
        answers: nil,
        toolName: toolName,
        reason: reason,
        resolution: resolution
    )
}

func makeProjectTaskDetail(
    task: ProjectTaskControlTask = makeProjectTaskControlTask(),
    interaction: ProjectTaskInteraction?,
    activity: ProjectTaskActivityTimeline? = nil
) -> ProjectTaskDetailResponse {
    ProjectTaskDetailResponse(
        task: task,
        interaction: interaction,
        activity: activity ?? ProjectTaskActivityTimeline(
            protocolVersion: 1,
            projectId: task.projectId,
            taskId: task.id,
            items: []
        ),
        plan: nil
    )
}

func makeProjectTaskActivityItem(
    id: String = "activity-1",
    type: String = "interaction.requested",
    category: String = "interaction",
    status: String = "waiting",
    title: String = "Waiting for your answer",
    detail: String? = "Which tone?",
    actionable: Bool = true,
    terminal: Bool = false
) -> ProjectTaskActivityItem {
    ProjectTaskActivityItem(
        protocolVersion: 1,
        id: id,
        projectId: "project-1",
        taskId: "task-1",
        runId: "run-1",
        type: type,
        category: category,
        status: status,
        title: title,
        detail: detail,
        items: [],
        occurredAt: "2026-09-05T12:00:00.000Z",
        sourceId: id,
        actionable: actionable,
        terminal: terminal
    )
}

func makeProjectTaskActivity(
    items: [ProjectTaskActivityItem] = [makeProjectTaskActivityItem()]
) -> ProjectTaskActivityTimeline {
    ProjectTaskActivityTimeline(
        protocolVersion: 1,
        projectId: "project-1",
        taskId: "task-1",
        items: items
    )
}

func makeConnectorApproval(state: String = "pending") -> ConnectorOperationApproval {
    ConnectorOperationApproval(
        id: "coa_action",
        runId: "run-1",
        completionId: "conversation-1",
        provider: "gmail",
        operation: "GMAIL_SEND_EMAIL",
        state: state,
        createdAt: "2026-09-05T12:00:00.000Z",
        expiresAt: "2026-09-05T12:10:00.000Z",
        resolvedAt: state == "pending" ? nil : "2026-09-05T12:01:00.000Z",
        consumedAt: state == "consumed" ? "2026-09-05T12:02:00.000Z" : nil
    )
}

func makeConnectorApprovalMessage() -> ChatMessage {
    ChatMessage(
        id: "approval-message",
        role: "tool",
        content: "Approval required",
        parts: [
            ChatMessagePart(
                type: "tool_result",
                name: "use_recipe_connector",
                status: "pending",
                data: .object([
                    "approvalRequired": .bool(true),
                    "approvalId": .string("coa_action"),
                    "provider": .string("gmail"),
                    "operation": .string("GMAIL_SEND_EMAIL")
                ])
            )
        ],
        completionId: "conversation-1",
        runId: "run-1",
        name: "use_recipe_connector",
        status: "pending"
    )
}

func makeInstantChatRunReplayPolicy() -> ChatRunReplayPolicy {
    ChatRunReplayPolicy(pollInterval: .zero, sleep: { _ in })
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

final class ConversationAPIClientStub: ConversationAPIClient {
    var streamEvents: [ChatStreamEvent] = []
    var streamedMessages: [ChatMessage] = []
    var streamedModelId: String?
    var streamedCompletionId: String?
    var streamCallCount = 0
    var streamedCommandId: String?
    var streamError: Error?
    var updatedConversationTitles: [(id: String, title: String)] = []
    var updatedConversationPayloads: [(id: String, title: String?, messages: [ChatMessage]?, parentConversationId: String?, parentMessageId: String?)] = []
    var deletedConversationIds: [String] = []
    var generatedTitle = "Generated title"
    var conversationDetail: ConversationDetailResponse?
    var conversationMessagePage: ConversationMessagePageResponse?
    var fetchConversationCallCount = 0
    var chatRunEventSnapshot: ChatRunSnapshotResponse?
    var chatRunReplayResponse: ChatRunReplayResponse?
    var chatRunCommandReceipt: ChatRunCommandReceipt?
    var cancelledRuns: [(id: String, expectedAttempt: Int, commandId: String)] = []
    var connectorApprovals: [ConnectorOperationApproval] = []
    var connectorApprovalFetchError: Error?
    var connectorApprovalResolutionError: Error?
    var resolvedConnectorApprovals: [(id: String, resolution: String)] = []
    var resumedConnectorApprovalId: String?
    var projectTaskDetails: [ProjectTaskDetailResponse] = []
    var projectTaskFetchError: Error?
    var projectTaskResponse: ProjectTaskResponse?
    var answerProjectTaskError: Error?
    var resolveProjectTaskApprovalError: Error?
    var answeredProjectTaskQuestions: [(projectId: String, taskId: String, interactionId: String, answers: [UserQuestionAnswer])] = []
    var resolvedProjectTaskApprovals: [(projectId: String, taskId: String, interactionId: String, resolution: String)] = []
    var fetchChatRunSnapshotCallCount = 0
    var fetchChatRunEventsCallCount = 0

    func fetchConversations(limit: Int, page: Int, includeArchived: Bool) async throws -> ConversationListResponse {
        throw TestFailure.unexpectedCall
    }

    func fetchConversation(
        id: String,
        refreshPending: Bool
    ) async throws -> ConversationDetailResponse {
        fetchConversationCallCount += 1

        guard let conversationDetail else {
            throw TestFailure.unexpectedCall
        }

        return conversationDetail
    }

    func fetchConversationMessages(id: String, before: String, limit: Int) async throws -> ConversationMessagePageResponse {
        guard let conversationMessagePage else {
            throw TestFailure.unexpectedCall
        }

        return conversationMessagePage
    }

    func streamChatCompletion(
        messages: [ChatMessage],
        modelId: String?,
        provider: String?,
        completionId: String?,
        settings: ChatSettings?,
        commandId: String
    ) -> AsyncThrowingStream<ChatStreamEvent, Error> {
        streamCallCount += 1
        streamedMessages = messages
        streamedModelId = modelId
        streamedCompletionId = completionId
        streamedCommandId = commandId

        return AsyncThrowingStream { continuation in
            for event in streamEvents {
                continuation.yield(event)
            }
            if let streamError {
                continuation.finish(throwing: streamError)
            } else {
                continuation.finish()
            }
        }
    }

    func fetchChatRunSnapshot(id: String) async throws -> ChatRunSnapshotResponse {
        fetchChatRunSnapshotCallCount += 1
        guard let chatRunEventSnapshot else {
            throw TestFailure.unexpectedCall
        }

        return chatRunEventSnapshot
    }

    func fetchChatRunEvents(
        id: String,
        after: Int,
        limit: Int
    ) async throws -> ChatRunReplayResponse {
        fetchChatRunEventsCallCount += 1
        guard let chatRunReplayResponse else {
            throw TestFailure.unexpectedCall
        }

        return chatRunReplayResponse
    }

    func cancelChatRun(
        id: String,
        expectedAttempt: Int,
        commandId: String
    ) async throws -> ChatRunCommandReceipt {
        cancelledRuns.append((id: id, expectedAttempt: expectedAttempt, commandId: commandId))

        guard let chatRunCommandReceipt else {
            throw TestFailure.unexpectedCall
        }

        return chatRunCommandReceipt
    }

    func fetchConnectorApproval(id: String) async throws -> ConnectorOperationApproval {
        if let connectorApprovalFetchError {
            throw connectorApprovalFetchError
        }

        guard !connectorApprovals.isEmpty else {
            throw TestFailure.unexpectedCall
        }

        return connectorApprovals.count == 1 ? connectorApprovals[0] : connectorApprovals.removeFirst()
    }

    func resolveConnectorApproval(
        id: String,
        resolution: String
    ) async throws -> ConnectorApprovalResolution {
        resolvedConnectorApprovals.append((id, resolution))

        if let connectorApprovalResolutionError {
            throw connectorApprovalResolutionError
        }

        return ConnectorApprovalResolution(id: id, state: resolution)
    }

    func streamApprovedConnectorOperation(
        messages: [ChatMessage],
        modelId: String?,
        provider: String?,
        completionId: String,
        settings: ChatSettings?,
        approvalId: String,
        commandId: String
    ) -> AsyncThrowingStream<ChatStreamEvent, Error> {
        resumedConnectorApprovalId = approvalId
        return streamChatCompletion(
            messages: messages,
            modelId: modelId,
            provider: provider,
            completionId: completionId,
            settings: settings,
            commandId: commandId
        )
    }

    func fetchProjectTask(projectId: String, taskId: String) async throws -> ProjectTaskDetailResponse {
        if let projectTaskFetchError {
            throw projectTaskFetchError
        }

        guard !projectTaskDetails.isEmpty else {
            throw TestFailure.unexpectedCall
        }

        return projectTaskDetails.count == 1 ? projectTaskDetails[0] : projectTaskDetails.removeFirst()
    }

    func answerProjectTaskQuestions(
        projectId: String,
        taskId: String,
        interactionId: String,
        answers: [UserQuestionAnswer]
    ) async throws -> ProjectTaskResponse {
        answeredProjectTaskQuestions.append((projectId, taskId, interactionId, answers))

        if let answerProjectTaskError {
            throw answerProjectTaskError
        }

        guard let projectTaskResponse else {
            throw TestFailure.unexpectedCall
        }

        return projectTaskResponse
    }

    func resolveProjectTaskApproval(
        projectId: String,
        taskId: String,
        interactionId: String,
        resolution: String
    ) async throws -> ProjectTaskResponse {
        resolvedProjectTaskApprovals.append((projectId, taskId, interactionId, resolution))

        if let resolveProjectTaskApprovalError {
            throw resolveProjectTaskApprovalError
        }

        guard let projectTaskResponse else {
            throw TestFailure.unexpectedCall
        }

        return projectTaskResponse
    }

    func generateTitle(conversationId: String, messages: [ChatMessage]) async throws -> TitleGenerationResponse {
        TitleGenerationResponse(title: generatedTitle)
    }

    func updateConversation(
        id: String,
        title: String?,
        messages: [ChatMessage]?,
        parentConversationId: String?,
        parentMessageId: String?
    ) async throws {
        updatedConversationPayloads.append((
            id: id,
            title: title,
            messages: messages,
            parentConversationId: parentConversationId,
            parentMessageId: parentMessageId
        ))
        if let title {
            updatedConversationTitles.append((id: id, title: title))
        }
    }

    func deleteConversation(id: String) async throws {
        deletedConversationIds.append(id)
    }
}
