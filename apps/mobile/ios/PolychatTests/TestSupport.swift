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
    supportsToolCalls: Bool? = nil,
    multimodal: Bool? = nil,
    isFeatured: Bool? = true,
    deprecated: Bool? = false,
    isDefault: Bool? = nil,
    isExecutable: Bool? = nil,
    runsOn: String? = nil,
    isPlatformEnabled: Bool? = nil,
    isFree: Bool? = nil,
    isByokEnabled: Bool? = nil,
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
        supportsToolCalls: supportsToolCalls,
        multimodal: multimodal,
        isFeatured: isFeatured,
        deprecated: deprecated,
        isDefault: isDefault,
        isExecutable: isExecutable,
        runsOn: runsOn,
        isPlatformEnabled: isPlatformEnabled,
        isFree: isFree,
        isByokEnabled: isByokEnabled,
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

func makeConversationDetail(id: String, itemsJSON: String) throws -> ConversationDetailResponse {
    let json = """
    {
        "id": "\(id)",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
        "is_archived": false,
        "items": [\(itemsJSON)]
    }
    """

    return try JSONDecoder().decode(ConversationDetailResponse.self, from: Data(json.utf8))
}

func makeResponse(
    status: String = "in_progress",
    attempt: Int = 1,
    projectId: String? = nil,
    projectTaskId: String? = nil,
    retry: ChatRetrySnapshot? = nil
) -> PlatformResponse {
    PlatformResponse(
        id: "run-1",
        conversationId: "conversation-1",
        status: status,
        attempt: attempt,
        initiatorUserId: 7,
        projectId: projectId,
        projectTaskId: projectTaskId,
        createdAt: "2026-09-05T12:00:00.000Z",
        updatedAt: "2026-09-05T12:00:01.000Z",
        startedAt: "2026-09-05T12:00:01.000Z",
        terminalReason: status == "failed" ? "Provider unavailable" : nil,
        retry: retry
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

func makeInstantResponseReplayPolicy() -> ResponseReplayPolicy {
    ResponseReplayPolicy(pollInterval: .zero, sleep: { _ in })
}

func makeIsolatedUserDefaults() throws -> UserDefaults {
    let suiteName = "PolychatTests.\(UUID().uuidString)"
    let defaults = try #require(UserDefaults(suiteName: suiteName))
    defaults.removePersistentDomain(forName: suiteName)
    return defaults
}

final class ModelsAPIClientStub: ModelsAPIClient {
    var result: Result<ModelsResponse, Error>
    var tierResult: Result<ModelTiersResponse, Error>
    var fetchModelsHandler: (() async throws -> ModelsResponse)?

    init(
        result: Result<ModelsResponse, Error>,
        tierResult: Result<ModelTiersResponse, Error> = .success(
            ModelTiersResponse(runtimes: [:], defaultTier: "medium")
        )
    ) {
        self.result = result
        self.tierResult = tierResult
    }

    func fetchModels() async throws -> ModelsResponse {
        if let fetchModelsHandler {
            return try await fetchModelsHandler()
        }

        return try result.get()
    }

    func fetchModelTiers() async throws -> ModelTiersResponse {
        try tierResult.get()
    }
}

final class ConversationAPIClientStub: ConversationAPIClient {
    var streamEvents: [ChatStreamEvent] = []
    var streamedMessages: [ChatMessage] = []
    var streamedModelId: String?
    var streamedConversationId: String?
    var streamCallCount = 0
    var streamedIdempotencyKey: String?
    var streamedAgentTeammateId: String?
    var streamedProjectId: String?
    var streamedSubject: ConversationSubject?
    var submittedApprovalBatches: [(responseId: String, decisions: [ToolApprovalDecision])] = []
    var streamError: Error?
    var updatedConversationTitles: [(id: String, title: String)] = []
    var updatedConversationPayloads: [(id: String, title: String?, messages: [ChatMessage]?, parentConversationId: String?, parentMessageId: String?)] = []
    var deletedConversationIds: [String] = []
    var generatedTitle = "Generated title"
    var conversationDetail: ConversationDetailResponse?
    var conversationMessagePage: ConversationMessagePageResponse?
    var fetchConversationCallCount = 0
    var responseSnapshot: ResponseSnapshot?
    var responseSnapshots: [ResponseSnapshot] = []
    var responseReplay: ResponseReplayResponse?
    var cancelledResponse: PlatformResponse?
    var cancelledResponses: [(id: String, expectedAttempt: Int, idempotencyKey: String)] = []
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
    var fetchResponseSnapshotCallCount = 0
    var fetchResponseEventsCallCount = 0
    func fetchConversations(limit: Int, after: String?, includeArchived: Bool) async throws -> ConversationListResponse {
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

    func streamResponse(
        messages: [ChatMessage],
        modelId: String?,
        provider: String?,
        conversationId: String?,
        settings: ChatSettings?,
        idempotencyKey: String,
        modelTier: String?,
        computeSite: String,
        agentTeammateId: String?,
        projectId: String?,
        subject: ConversationSubject?
    ) -> AsyncThrowingStream<ChatStreamEvent, Error> {
        streamCallCount += 1
        streamedSubject = subject
        streamedProjectId = projectId
        streamedAgentTeammateId = agentTeammateId
        streamedMessages = messages
        streamedModelId = modelId
        streamedConversationId = conversationId
        streamedIdempotencyKey = idempotencyKey

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

    func fetchResponseSnapshot(id: String) async throws -> ResponseSnapshot {
        fetchResponseSnapshotCallCount += 1
        if !responseSnapshots.isEmpty {
            return responseSnapshots.removeFirst()
        }
        guard let responseSnapshot else {
            throw TestFailure.unexpectedCall
        }

        return responseSnapshot
    }

    func fetchResponseEvents(
        id: String,
        after: Int,
        limit: Int
    ) async throws -> ResponseReplayResponse {
        fetchResponseEventsCallCount += 1
        guard let responseReplay else {
            throw TestFailure.unexpectedCall
        }

        return responseReplay
    }

    func cancelResponse(
        id: String,
        expectedAttempt: Int,
        idempotencyKey: String
    ) async throws -> PlatformResponse {
        cancelledResponses.append((id: id, expectedAttempt: expectedAttempt, idempotencyKey: idempotencyKey))

        guard let cancelledResponse else {
            throw TestFailure.unexpectedCall
        }

        return cancelledResponse
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
        conversationId: String,
        settings: ChatSettings?,
        approvalId: String,
        idempotencyKey: String,
        modelTier: String?,
        computeSite: String,
        projectId: String?
    ) -> AsyncThrowingStream<ChatStreamEvent, Error> {
        resumedConnectorApprovalId = approvalId
        return streamResponse(
            messages: messages,
            modelId: modelId,
            provider: provider,
            conversationId: conversationId,
            settings: settings,
            idempotencyKey: idempotencyKey,
            modelTier: modelTier,
            computeSite: computeSite,
            agentTeammateId: nil,
            projectId: projectId,
            subject: nil
        )
    }

    func streamApprovalDecisions(
        responseId: String,
        decisions: [ToolApprovalDecision],
        idempotencyKey: String
    ) -> AsyncThrowingStream<ChatStreamEvent, Error> {
        submittedApprovalBatches.append((responseId: responseId, decisions: decisions))
        return streamResponse(
            messages: [],
            modelId: nil,
            provider: nil,
            conversationId: nil,
            settings: nil,
            idempotencyKey: idempotencyKey,
            modelTier: nil,
            computeSite: "hosted",
            agentTeammateId: nil,
            projectId: nil,
            subject: nil
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

final class AgeGateAPIClientStub: AgeGateAPIClient {
    var fetchResult: Result<AgeGateResponse, Error>
    var confirmResult: Result<AgeGateResponse, Error>
    private(set) var fetchCount = 0
    private(set) var confirmedBirthDates: [String] = []

    init(
        fetchResult: Result<AgeGateResponse, Error>,
        confirmResult: Result<AgeGateResponse, Error> = .success(AgeGateResponse(status: .adult))
    ) {
        self.fetchResult = fetchResult
        self.confirmResult = confirmResult
    }

    func fetchAgeGate() async throws -> AgeGateResponse {
        fetchCount += 1
        return try fetchResult.get()
    }

    func confirmAge(birthDate: String) async throws -> AgeGateResponse {
        confirmedBirthDates.append(birthDate)
        return try confirmResult.get()
    }
}
