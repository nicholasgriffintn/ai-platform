import Foundation
import Combine

@MainActor
class ConversationManager: ObservableObject {
    @Published var currentConversation: Conversation?
    private(set) var teammateIdsByConversation: [String: String] = [:]
    @Published var conversations: [Conversation] = []
    @Published var selectedModelId: String?
    @Published var isLoading: Bool = false
    @Published var loadingConversationID: String?
    @Published private(set) var isLoadingEarlierMessages = false
    @Published var error: String?
    @Published var usageLimits: ChatUsageLimits?
    @Published private(set) var currentTaskInteraction: ProjectTaskInteractionControl?
    @Published private(set) var currentTaskActivity: ProjectTaskActivityTimeline?
    @Published private(set) var currentConnectorApproval: ConnectorApprovalControl?
    @Published private(set) var turnActivities: [String: TurnActivityProjection] = [:]
    @Published private(set) var approvalDecisions: [String: ToolApprovalDecision] = [:]
    @Published private(set) var isSubmittingApprovals = false

    private var apiClient: (any ConversationAPIClient)?
    private var modelsStore: ModelsStore?
    private var responseReplayPolicy = ResponseReplayPolicy()
    private var streamPublishInterval: Duration = .milliseconds(50)
    private var locallyStreamingConversationIds: Set<String> = []
    private var knownConversations: [String: Conversation] = [:]

    func configure(
        apiClient: any ConversationAPIClient,
        modelsStore: ModelsStore? = nil,
        responseReplayPolicy: ResponseReplayPolicy = ResponseReplayPolicy(),
        streamPublishInterval: Duration = .milliseconds(50)
    ) {
        self.apiClient = apiClient
        self.modelsStore = modelsStore
        self.responseReplayPolicy = responseReplayPolicy
        self.streamPublishInterval = streamPublishInterval
    }

    func reset() {
        currentConversation = nil
        conversations = []
        knownConversations = [:]
        teammateIdsByConversation = [:]
        selectedModelId = nil
        isLoading = false
        loadingConversationID = nil
        isLoadingEarlierMessages = false
        error = nil
        usageLimits = nil
        currentTaskInteraction = nil
        currentTaskActivity = nil
        currentConnectorApproval = nil
        turnActivities = [:]
        approvalDecisions = [:]
        isSubmittingApprovals = false
        locallyStreamingConversationIds = []
    }

    var pendingApprovals: [ToolApprovalRequest] {
        let pending = (currentConversation?.messages ?? []).filter { message in
            message.role == "tool" && message.status == "pending"
                && message.approvalRequest.map { !$0.isResolved && $0.isDirectResolution } == true
        }
        let runId = pending.last?.runId
        return pending
            .filter { runId == nil || $0.runId == runId }
            .compactMap(\.approvalRequest)
    }

    func decideApproval(_ request: ToolApprovalRequest, option: String) async {
        approvalDecisions[request.interactionId] = request.decision(for: option)
        await submitApprovalsIfReady()
    }

    func decideRemainingApprovals(approve: Bool) async {
        for request in pendingApprovals where approvalDecisions[request.interactionId] == nil && request.approvalRequired {
            let option = request.options.first { $0.lowercased() == (approve ? "approve" : "reject") }
                ?? (approve ? "Approve" : "Reject")
            approvalDecisions[request.interactionId] = request.decision(for: option)
        }
        await submitApprovalsIfReady()
    }

    func submitApprovalsIfReady() async {
        guard let conversation = currentConversation,
              !isSubmittingApprovals,
              !isStreaming(conversation.id) else {
            return
        }

        let pending = pendingApprovals
        let decisions = pending.compactMap { approvalDecisions[$0.interactionId] }
        let runId = conversation.messages.last { $0.approvalRequest?.interactionId == pending.last?.interactionId }?.runId
            ?? conversation.latestResponse?.id

        guard !pending.isEmpty, decisions.count == pending.count, let runId else {
            return
        }

        isSubmittingApprovals = true
        defer { isSubmittingApprovals = false }

        await generateAssistantResponse(
            conversationId: conversation.id,
            requestMessages: conversation.messages,
            settings: nil,
            generateTitle: false,
            kind: .approvals(responseId: runId, decisions: decisions)
        )
        approvalDecisions = [:]
    }

    func conversation(withId id: String) -> Conversation? {
        if currentConversation?.id == id {
            return currentConversation
        }

        return knownConversations[id] ?? conversations.first { $0.id == id }
    }

    func isStreaming(_ conversationId: String) -> Bool {
        locallyStreamingConversationIds.contains(conversationId)
    }

    func loadConversations() async {
        isLoading = true
        defer { isLoading = false }

        do {
            guard let apiClient = apiClient else {
                throw NSError(domain: "com.polychat.app", code: 1,
                             userInfo: [NSLocalizedDescriptionKey: "API client not configured"])
            }

            let response = try await apiClient.fetchConversations()
            let fetched = response.conversations.map { summary in
                var conversation = Conversation(
                    id: summary.id,
                    title: summary.title ?? "New Conversation",
                    messages: [],
                    createdAt: AppDateParser.parse(summary.createdAt, fallback: Date()),
                    modelId: summary.model,
                    modelTier: summary.modelTier,
                    isLoadedFromAPI: true,
                    lastMessageAt: AppDateParser.parse(summary.lastMessageAt ?? summary.updatedAt),
                    messageCount: summary.messageCount ?? 0
                )
                conversation.isPinned = summary.isPinned
                conversation.isUnread = summary.isUnread && currentConversation?.id != summary.id

                if let known = knownConversations[summary.id],
                   known.lastMessageAt == conversation.lastMessageAt || isStreaming(summary.id) {
                    conversation.messages = known.messages
                    conversation.latestResponse = known.latestResponse
                    conversation.hasMoreMessages = known.hasMoreMessages
                    conversation.oldestMessageId = known.oldestMessageId
                }

                return conversation
            }
            let fetchedIds = Set(fetched.map(\.id))
            let localOnly = conversations.filter { !$0.isLoadedFromAPI && !fetchedIds.contains($0.id) }

            conversations = localOnly + fetched.sorted { lhs, rhs in
                lhs.isPinned != rhs.isPinned
                    ? lhs.isPinned
                    : (lhs.lastMessageAt ?? lhs.createdAt) > (rhs.lastMessageAt ?? rhs.createdAt)
            }
            error = nil
        } catch {
            self.error = "Failed to load conversations: \(error.localizedDescription)"
        }
    }

    func refreshConversations() async {
        await loadConversations()
    }

    func loadConversationMessages(id conversationId: String) async {
        let conversation = self.conversation(withId: conversationId) ?? Conversation(
            id: conversationId,
            title: "Conversation",
            messages: [],
            createdAt: Date(),
            isLoadedFromAPI: true,
            messageCount: 0
        )

        await loadConversationMessages(conversation)
    }

    func bindTeammates(_ teammateIds: [String: String]) {
        teammateIdsByConversation.merge(teammateIds) { _, latest in latest }
    }

    func loadConversationMessages(_ conversation: Conversation) async {
        guard !Task.isCancelled else {
            return
        }

        var conversation = knownConversations[conversation.id] ?? conversation
        conversation.isUnread = false
        let shouldLoadMessages = conversation.messages.isEmpty && conversation.isLoadedFromAPI
        loadingConversationID = shouldLoadMessages ? conversation.id : nil
        if currentConversation?.id != conversation.id {
            currentTaskInteraction = nil
            currentTaskActivity = nil
            currentConnectorApproval = nil
        }
        currentConversation = conversation
        store(conversation)

        guard conversation.isLoadedFromAPI, !isStreaming(conversation.id) else {
            loadingConversationID = nil
            return
        }

        await refreshConversation(id: conversation.id, refreshPending: true)

        if loadingConversationID == conversation.id {
            loadingConversationID = nil
        }
    }

    func refreshCurrentConversation() async {
        guard let conversation = currentConversation,
              conversation.isLoadedFromAPI,
              !isStreaming(conversation.id) else {
            return
        }

        await refreshConversation(id: conversation.id, refreshPending: false)
    }

    private func refreshConversation(id conversationId: String, refreshPending: Bool) async {
        guard let apiClient else {
            return
        }

        do {
            let detail = try await apiClient.fetchConversation(id: conversationId, refreshPending: refreshPending)
            guard !Task.isCancelled,
                  !isStreaming(conversationId),
                  let conversation = conversation(withId: conversationId) else {
                return
            }

            store(applying(detail, to: conversation))
        } catch is CancellationError {
            return
        } catch {
            if currentConversation?.id == conversationId {
                self.error = "Failed to load conversation: \(error.localizedDescription)"
            }
        }
    }

    func conversationChangedRemotely(id conversationId: String) async {
        if currentConversation?.id == conversationId {
            await refreshCurrentConversation()
        } else if knownConversations[conversationId] != nil {
            knownConversations[conversationId]?.messages = []
        }
    }

    func conversationDeletedRemotely(id conversationId: String) {
        conversations.removeAll { $0.id == conversationId }
        knownConversations.removeValue(forKey: conversationId)
    }

    func loadEarlierMessages() async {
        guard !isLoadingEarlierMessages,
              var conversation = currentConversation,
              conversation.hasMoreMessages,
              let oldestMessageId = conversation.oldestMessageId,
              let apiClient else {
            return
        }

        isLoadingEarlierMessages = true
        defer { isLoadingEarlierMessages = false }

        do {
            let page = try await apiClient.fetchConversationMessages(
                id: conversation.id,
                before: oldestMessageId
            )
            let existingIds = Set(conversation.messages.map(\.id))
            let earlierMessages = page.messages.filter { !existingIds.contains($0.id) }

            conversation.messages = earlierMessages + conversation.messages
            conversation.hasMoreMessages = page.hasMore
            conversation.oldestMessageId = page.oldestMessageId ?? earlierMessages.first?.id ?? oldestMessageId
            store(conversation)
        } catch {
            self.error = "Failed to load earlier messages: \(error.localizedDescription)"
        }
    }

    func observeCurrentRun() async {
        var replayState: ResponseReplayState?

        while !Task.isCancelled {
            guard let apiClient,
                  let conversation = currentConversation,
                  let response = conversation.latestResponse,
                  !isStreaming(conversation.id) else {
                return
            }

            await refreshProjectTaskInteraction(response: response, conversationId: conversation.id)
            await refreshConnectorApproval(response: response, conversationId: conversation.id)

            guard response.isActive else {
                return
            }

            do {
                if replayState == nil {
                    let snapshot = try await apiClient.fetchResponseSnapshot(id: response.id)
                    replayState = ResponseReplayState(cursor: snapshot.cursor, snapshot: snapshot)
                } else if let currentState = replayState {
                    let replay = try await apiClient.fetchResponseEvents(
                        id: response.id,
                        after: currentState.cursor
                    )
                    let outcome = ResponseReplay.apply(state: currentState, response: replay)

                    if outcome.requiresSnapshot {
                        let snapshot = try await apiClient.fetchResponseSnapshot(id: response.id)
                        replayState = ResponseReplayState(cursor: snapshot.cursor, snapshot: snapshot)
                    } else {
                        replayState = outcome.state
                    }

                    if replayState?.snapshot.response.isTerminal == true {
                        let snapshot = try await apiClient.fetchResponseSnapshot(id: response.id)
                        if let currentReplayState = replayState {
                            replayState = ResponseReplay.reconcile(
                                state: currentReplayState,
                                snapshot: snapshot
                            )
                        }
                    }
                }

                guard currentConversation?.id == conversation.id,
                      currentConversation?.latestResponse?.id == response.id,
                      let replayState else {
                    return
                }

                applyResponseSnapshot(conversationId: conversation.id, snapshot: replayState.snapshot)

                if replayState.snapshot.response.isTerminal {
                    return
                }
            } catch is CancellationError {
                return
            } catch {
                self.error = "Task status could not be refreshed: \(error.localizedDescription)"
            }

            do {
                try await responseReplayPolicy.sleep(responseReplayPolicy.pollInterval)
            } catch {
                return
            }
        }
    }

    func refreshCurrentTaskInteraction() async {
        guard let conversation = currentConversation, let response = conversation.latestResponse else {
            currentTaskInteraction = nil
            currentTaskActivity = nil
            return
        }

        await refreshProjectTaskInteraction(response: response, conversationId: conversation.id)
    }

    func refreshCurrentConnectorApproval() async {
        guard let conversation = currentConversation, let response = conversation.latestResponse else {
            currentConnectorApproval = nil
            return
        }

        await refreshConnectorApproval(response: response, conversationId: conversation.id)
    }

    func answerCurrentTaskQuestions(_ answers: [UserQuestionAnswer]) async {
        guard let control = currentTaskInteraction,
              control.interaction.type == "question",
              control.acceptsSubmission else {
            return
        }

        let interactionId = control.interaction.interactionId
        setTaskInteractionSubmission(.submitting, interactionId: interactionId)

        do {
            guard let apiClient else {
                throw NSError(
                    domain: "com.polychat.app",
                    code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "API client not configured"]
                )
            }

            _ = try await apiClient.answerProjectTaskQuestions(
                projectId: control.task.projectId,
                taskId: control.task.id,
                interactionId: interactionId,
                answers: answers
            )
            setTaskInteractionSubmission(.acknowledged, interactionId: interactionId)
            await refreshCurrentTaskInteraction()
        } catch {
            await reconcileTaskInteractionFailure(error, control: control)
        }
    }

    func resolveCurrentTaskApproval(_ resolution: String) async {
        guard resolution == "approved" || resolution == "rejected",
              let control = currentTaskInteraction,
              control.interaction.type == "approval",
              control.acceptsSubmission else {
            return
        }

        let interactionId = control.interaction.interactionId
        setTaskInteractionSubmission(.submitting, interactionId: interactionId)

        do {
            guard let apiClient else {
                throw NSError(
                    domain: "com.polychat.app",
                    code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "API client not configured"]
                )
            }

            _ = try await apiClient.resolveProjectTaskApproval(
                projectId: control.task.projectId,
                taskId: control.task.id,
                interactionId: interactionId,
                resolution: resolution
            )
            setTaskInteractionSubmission(.acknowledged, interactionId: interactionId)
            await refreshCurrentTaskInteraction()
        } catch {
            await reconcileTaskInteractionFailure(error, control: control)
        }
    }

    func resolveCurrentConnectorApproval(_ resolution: String) async {
        guard resolution == "approved" || resolution == "rejected",
              let control = currentConnectorApproval,
              control.acceptsResolution else {
            return
        }

        let approvalId = control.approval.id
        setConnectorApprovalSubmission(.submitting, approvalId: approvalId)

        do {
            guard let apiClient else {
                throw NSError(
                    domain: "com.polychat.app",
                    code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "API client not configured"]
                )
            }

            _ = try await apiClient.resolveConnectorApproval(id: approvalId, resolution: resolution)
            setConnectorApprovalSubmission(.acknowledged, approvalId: approvalId)

            if resolution == "approved",
               let conversation = currentConversation,
               conversation.id == control.approval.completionId {
                await generateAssistantResponse(
                    conversationId: conversation.id,
                    requestMessages: conversation.messages,
                    settings: nil,
                    generateTitle: false,
                    kind: .connectorApproval(approvalId)
                )
            }

            await refreshCurrentConnectorApproval()
        } catch {
            await reconcileConnectorApprovalFailure(error, control: control)
        }
    }

    func continueCurrentConnectorApproval() async {
        guard let control = currentConnectorApproval,
              control.canContinueApprovedOperation,
              let conversation = currentConversation,
              conversation.id == control.approval.completionId else {
            return
        }

        setConnectorApprovalSubmission(.submitting, approvalId: control.approval.id)
        await generateAssistantResponse(
            conversationId: conversation.id,
            requestMessages: conversation.messages,
            settings: nil,
            generateTitle: false,
            kind: .connectorApproval(control.approval.id)
        )
        await refreshCurrentConnectorApproval()
    }

    func cancelCurrentRun() async {
        guard let apiClient,
              let conversation = currentConversation,
              let response = conversation.latestResponse,
              response.isActive else {
            return
        }

        do {
            let cancelled = try await apiClient.cancelResponse(
                id: response.id,
                expectedAttempt: response.attempt
            )
            guard currentConversation?.id == conversation.id,
                  currentConversation?.latestResponse?.id == response.id,
                  currentConversation?.latestResponse?.attempt == response.attempt else {
                return
            }

            updateResponse(cancelled, conversationId: conversation.id)
        } catch {
            self.error = "The task could not be stopped: \(error.localizedDescription)"
        }
    }

    func startNewConversation(projectId: String? = nil, subject: ConversationSubject? = nil) -> Conversation {
        var newConversation = Conversation(
            id: UUID().uuidString,
            title: "New Conversation",
            messages: [],
            createdAt: Date(),
            isLoadedFromAPI: false,
            lastMessageAt: nil,
            messageCount: 0
        )
        newConversation.projectId = projectId
        newConversation.subject = subject
        currentTaskInteraction = nil
        currentTaskActivity = nil
        currentConnectorApproval = nil
        currentConversation = newConversation
        knownConversations[newConversation.id] = newConversation
        return newConversation
    }

    func addMessage(_ message: ChatMessage, settings: ChatSettings? = nil) async throws {
        guard var conversation = currentConversation else {
            throw NSError(domain: "com.polychat.app", code: 3,
                         userInfo: [NSLocalizedDescriptionKey: "No active conversation"])
        }

        conversation.messages.append(message)
        conversation.lastMessageAt = Date()
        conversation.messageCount = conversation.messages.count
        if conversation.projectId == nil, !conversations.contains(where: { $0.id == conversation.id }) {
            conversations.insert(conversation, at: 0)
        }
        store(conversation)

        await generateAssistantResponse(
            conversationId: conversation.id,
            requestMessages: conversation.messages,
            settings: settings,
            generateTitle: true
        )
    }

    func regenerateAssistantMessage(_ messageId: String, settings: ChatSettings? = nil) async {
        guard let conversation = currentConversation,
              let messageIndex = conversation.messages.firstIndex(where: { $0.id == messageId }) else {
            error = "Unable to retry: message not found"
            return
        }

        let message = conversation.messages[messageIndex]
        let retryEndIndex: Int

        if message.isCompactionMarker {
            error = "Only user and assistant messages can be retried"
            return
        }

        if message.role == "assistant" {
            retryEndIndex = conversation.messages[..<messageIndex].lastIndex { $0.role == "user" }.map { $0 + 1 } ?? messageIndex
        } else if message.role == "user" {
            retryEndIndex = messageIndex + 1
        } else {
            error = "Only user and assistant messages can be retried"
            return
        }

        await regenerateConversation(
            conversation,
            through: retryEndIndex,
            settings: settings,
            missingUserError: "Unable to retry without a user message"
        )
    }

    func editUserMessage(_ messageId: String, text: String, settings: ChatSettings? = nil) async {
        let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedText.isEmpty else {
            error = "Message cannot be empty"
            return
        }

        guard let currentConversation = currentConversation,
              let messageIndex = currentConversation.messages.firstIndex(where: { $0.id == messageId }) else {
            error = "Unable to edit: message not found"
            return
        }

        let message = currentConversation.messages[messageIndex]
        guard !message.isCompactionMarker, message.role == "user" else {
            error = "Only user messages can be edited"
            return
        }

        var conversation = currentConversation
        conversation.messages[messageIndex] = conversation.messages[messageIndex].replacingTextContent(with: trimmedText)

        await regenerateConversation(
            conversation,
            through: messageIndex + 1,
            settings: settings,
            missingUserError: "Unable to regenerate without a user message"
        )
    }

    private func regenerateConversation(
        _ conversation: Conversation,
        through retryEndIndex: Int,
        settings: ChatSettings?,
        missingUserError: String
    ) async {
        var conversation = conversation
        let requestMessages = Array(conversation.messages.prefix(retryEndIndex))
        guard requestMessages.contains(where: { $0.role == "user" }) else {
            error = missingUserError
            return
        }

        conversation.messages = requestMessages
        conversation.lastMessageAt = Date()
        conversation.messageCount = requestMessages.count
        store(conversation)

        await generateAssistantResponse(
            conversationId: conversation.id,
            requestMessages: requestMessages,
            settings: settings,
            generateTitle: false
        )
    }

    private func generateAssistantResponse(
        conversationId: String,
        requestMessages: [ChatMessage],
        settings: ChatSettings?,
        generateTitle: Bool,
        kind: TurnRequestKind = .message
    ) async {
        guard let conversation = conversation(withId: conversationId) else {
            return
        }

        let commandId = UUID().uuidString
        locallyStreamingConversationIds.insert(conversationId)
        turnActivities[conversationId] = TurnActivityProjection()
        defer {
            locallyStreamingConversationIds.remove(conversationId)
            turnActivities.removeValue(forKey: conversationId)
        }

        var assembler = ResponseTurnAssembler(
            completionId: conversationId,
            initialMessageId: UUID().uuidString,
            model: conversation.modelId
        )
        var compactionStatus: ChatMessage?
        var didReceiveStreamEvent = false
        let clock = ContinuousClock()
        var lastPublishedAt = clock.now

        func publish(_ turnMessages: [ChatMessage], updateList: Bool) {
            update(conversationId, updateList: updateList) { conversation in
                conversation.messages = requestMessages + [compactionStatus].compactMap { $0 } + turnMessages
                conversation.lastMessageAt = Date()
                conversation.messageCount = conversation.messages.count
            }
            lastPublishedAt = clock.now
        }

        publish(assembler.messages, updateList: true)

        do {
            let requestedModelId = conversation.modelTier == nil
                ? conversation.modelId ?? selectedModelId ?? modelsStore?.selectedModelId
                : nil
            let requestedModelTier = conversation.modelId == nil
                ? conversation.modelTier ?? (requestedModelId == nil ? modelsStore?.selectedModelTier : nil)
                : nil
            let selectedModel = requestedModelId.flatMap { modelsStore?.model(withId: $0) }

            if let requestedModelId {
                guard let selectedModel, selectedModel.isAvailableForSelection else {
                    throw NSError(
                        domain: "com.polychat.app",
                        code: 4,
                        userInfo: [
                            NSLocalizedDescriptionKey: "Selected model \(requestedModelId) is no longer available. Choose another model before sending."
                        ]
                    )
                }
            }

            guard let apiClient else {
                throw NSError(domain: "com.polychat.app", code: 1,
                             userInfo: [NSLocalizedDescriptionKey: "API client not configured"])
            }

            let computeSite = selectedModel?.machineId == nil ? "hosted" : "machine"
            let stream: AsyncThrowingStream<ChatStreamEvent, Error>
            switch kind {
            case .message:
                stream = apiClient.streamResponse(
                    messages: requestMessages,
                    modelId: selectedModel?.id,
                    provider: selectedModel?.provider,
                    conversationId: conversationId,
                    settings: settings,
                    idempotencyKey: commandId,
                    modelTier: requestedModelTier,
                    computeSite: computeSite,
                    agentTeammateId: teammateIdsByConversation[conversationId],
                    projectId: conversation.projectId,
                    subject: conversation.subject
                )
            case .connectorApproval(let approvalId):
                stream = apiClient.streamApprovedConnectorOperation(
                    messages: requestMessages,
                    modelId: selectedModel?.id,
                    provider: selectedModel?.provider,
                    conversationId: conversationId,
                    settings: settings,
                    approvalId: approvalId,
                    idempotencyKey: commandId,
                    modelTier: requestedModelTier,
                    computeSite: computeSite,
                    projectId: conversation.projectId
                )
            case .approvals(let responseId, let decisions):
                stream = apiClient.streamApprovalDecisions(
                    responseId: responseId,
                    decisions: decisions,
                    idempotencyKey: commandId
                )
            }

            var responsivenessGate = ChatStreamResponsivenessGate()

            for try await event in stream {
                didReceiveStreamEvent = true

                switch event {
                case .state(let state) where state == "compaction":
                    compactionStatus = compactionStatusMessage(
                        id: CompactionStatusMarker.pendingId(for: conversationId),
                        completionId: conversationId,
                        label: CompactionStatusLabels.automaticPending,
                        status: CompactionPartStatus.pending
                    )
                case .compaction(let message) where message.isCompactionMarker:
                    compactionStatus = message
                case .content, .reasoning, .metadata:
                    if let pending = compactionStatus, CompactionStatusMarker.isPendingId(pending.id) {
                        compactionStatus = compactionStatusMessage(
                            id: pending.id,
                            completionId: conversationId,
                            label: CompactionStatusLabels.automaticCompleted,
                            status: CompactionPartStatus.completed
                        )
                    }
                case .response(let response):
                    updateResponse(response, conversationId: conversationId)
                case .turnActivity(let activity):
                    var projection = turnActivities[conversationId] ?? TurnActivityProjection()
                    projection.apply(activity)
                    turnActivities[conversationId] = projection
                case .usageLimits(let limits):
                    usageLimits = limits
                case .conversationTitle(let title):
                    applyConversationTitle(conversationId, title: title)
                default:
                    break
                }

                if assembler.apply(event) {
                    if !event.isProgressDelta || clock.now - lastPublishedAt >= streamPublishInterval {
                        publish(assembler.messages, updateList: false)
                    }
                }

                if responsivenessGate.shouldYield(after: event) {
                    await Task.yield()
                }
            }

            var finished = assembler.finishedMessages
            if !finished.contains(where: { $0.role == "assistant" }) {
                finished.append(ChatMessage(
                    id: assembler.currentMessageId ?? UUID().uuidString,
                    role: "assistant",
                    content: "No response",
                    completionId: conversationId,
                    status: "completed"
                ))
            }
            publish(finished, updateList: true)
            update(conversationId) { $0.isLoadedFromAPI = true }

            if selectedModel?.machineId != nil, let stored = self.conversation(withId: conversationId) {
                try await apiClient.updateConversation(
                    id: conversationId, title: stored.title, messages: stored.messages,
                    parentConversationId: nil, parentMessageId: nil
                )
            }

            locallyStreamingConversationIds.remove(conversationId)
            if let detail = try? await apiClient.fetchConversation(id: conversationId, refreshPending: false),
               let stored = self.conversation(withId: conversationId) {
                store(applying(detail, to: stored))
            }

            if generateTitle, let updated = self.conversation(withId: conversationId) {
                await generateTitleIfNeeded(for: updated)
            }
        } catch {
            let failure = ChatMessage(
                id: assembler.currentMessageId ?? UUID().uuidString,
                role: "assistant",
                content: "Error: \(error.localizedDescription)",
                completionId: conversationId,
                status: "failed"
            )
            compactionStatus = compactionStatus.flatMap { CompactionStatusMarker.isPendingId($0.id) ? nil : $0 }
            publish(assembler.finishedMessages.filter { $0.id != failure.id } + [failure], updateList: true)
            update(conversationId) { $0.isLoadedFromAPI = $0.isLoadedFromAPI || didReceiveStreamEvent }
        }
    }

    func turnActivityLabel(for conversationId: String?) -> String? {
        guard let conversationId else {
            return nil
        }

        return turnActivities[conversationId]?.label
    }

    private func applyResponseSnapshot(conversationId: String, snapshot: ResponseSnapshot) {
        update(conversationId) { conversation in
            let authoritativeIds = Set(snapshot.messages.map(\.id))
            conversation.messages.removeAll { message in
                !authoritativeIds.contains(message.id) && message.runId == snapshot.response.id
            }

            for message in snapshot.messages {
                if let messageIndex = conversation.messages.firstIndex(where: { $0.id == message.id }) {
                    conversation.messages[messageIndex] = message
                } else {
                    conversation.messages.append(message)
                }
            }

            conversation.latestResponse = snapshot.response
            conversation.isLoadedFromAPI = true
            conversation.messageCount = conversation.messages.count
            conversation.lastMessageAt = Date()
        }
    }

    private func updateResponse(_ response: PlatformResponse, conversationId: String) {
        update(conversationId) { $0.latestResponse = response }
    }

    private func store(_ conversation: Conversation, updateList: Bool = true) {
        knownConversations[conversation.id] = conversation

        if updateList, let index = conversations.firstIndex(where: { $0.id == conversation.id }) {
            conversations[index] = conversation
        }

        if currentConversation?.id == conversation.id {
            currentConversation = conversation
        }
    }

    private func update(
        _ conversationId: String,
        updateList: Bool = true,
        _ change: (inout Conversation) -> Void
    ) {
        guard var conversation = conversation(withId: conversationId) else {
            return
        }

        change(&conversation)
        store(conversation, updateList: updateList)
    }

    private func applying(
        _ detail: ConversationDetailResponse,
        to conversation: Conversation
    ) -> Conversation {
        var updatedConversation = conversation

        updatedConversation.messages = detail.messages
        updatedConversation.title = detail.title ?? conversation.title
        updatedConversation.modelId = detail.model
        updatedConversation.modelTier = detail.modelTier
        updatedConversation.lastMessageAt = AppDateParser.parse(detail.lastMessageAt ?? detail.updatedAt)
        updatedConversation.messageCount = detail.messageCount ?? detail.messages.count
        updatedConversation.latestResponse = detail.latestResponse
        updatedConversation.hasMoreMessages = detail.hasMoreMessages
        updatedConversation.oldestMessageId = detail.oldestMessageId ?? detail.messages.first?.id
        updatedConversation.projectId = detail.projectId ?? conversation.projectId
        updatedConversation.isLoadedFromAPI = true

        return updatedConversation
    }

    private func compactionStatusMessage(
        id: String,
        completionId: String,
        label: String,
        status: String
    ) -> ChatMessage {
        let timestamp = Date().timeIntervalSince1970 * 1000
        return ChatMessage(
            id: id,
            role: "compaction",
            content: label,
            parts: [
                ChatMessagePart(
                    id: "\(id)-part",
                    type: "compaction",
                    label: label,
                    status: status,
                    timestamp: timestamp
                )
            ],
            completionId: completionId,
            timestamp: timestamp
        )
    }

    func setModelForCurrentConversation(_ modelId: String) {
        selectedModelId = modelId
        modelsStore?.selectModel(modelId)
        guard let id = currentConversation?.id else { return }
        update(id) { conversation in
            conversation.modelId = modelId
            conversation.modelTier = nil
        }
    }

    func setTierForCurrentConversation(_ tier: String) {
        selectedModelId = nil
        modelsStore?.selectTier(tier)
        guard let id = currentConversation?.id else { return }
        update(id) { conversation in
            conversation.modelId = nil
            conversation.modelTier = tier
        }
    }

    func generateTitleIfNeeded(for conversation: Conversation) async {
        let shouldGenerateTitles = UserDefaults.standard.object(forKey: "autoTitleGeneration") as? Bool ?? true
        guard shouldGenerateTitles else {
            return
        }

        guard conversation.messages.count >= 2,
              conversation.title == "New Conversation" || conversation.title.hasPrefix("New Conversation") else {
            return
        }

        do {
            let titleResponse = try await apiClient?.generateTitle(conversationId: conversation.id, messages: conversation.messages)
            if let title = titleResponse?.title {
                await updateConversationTitle(conversation.id, title: title)
            }
        } catch {
            if let firstUserMessage = conversation.messages.first(where: { $0.role == "user" }) {
                let truncatedTitle = String(firstUserMessage.content.textValue.prefix(30))
                await updateConversationTitle(conversation.id, title: truncatedTitle)
            }
        }
    }

    func applyConversationTitle(_ conversationId: String, title: String) {
        update(conversationId) { $0.title = title }
    }

    func updateConversationTitle(_ conversationId: String, title: String) async {
        applyConversationTitle(conversationId, title: title)

        guard conversation(withId: conversationId)?.isLoadedFromAPI == true else {
            return
        }

        do {
            try await apiClient?.updateConversation(id: conversationId, title: title)
        } catch {
            self.error = "Failed to update title: \(error.localizedDescription)"
        }
    }

    private func refreshProjectTaskInteraction(response: PlatformResponse, conversationId: String) async {
        guard let projectId = response.projectId, let taskId = response.projectTaskId else {
            currentTaskInteraction = nil
            currentTaskActivity = nil
            return
        }

        if currentTaskInteraction?.task.projectId != projectId ||
            currentTaskInteraction?.task.id != taskId ||
            (currentTaskInteraction?.interaction.runId != nil &&
                currentTaskInteraction?.interaction.runId != response.id) ||
            currentTaskActivity?.projectId != projectId ||
            currentTaskActivity?.taskId != taskId {
            currentTaskInteraction = nil
            currentTaskActivity = nil
        }

        do {
            guard let apiClient else {
                return
            }

            let detail = try await apiClient.fetchProjectTask(projectId: projectId, taskId: taskId)

            guard currentConversation?.id == conversationId,
                  currentConversation?.latestResponse?.id == response.id,
                  detail.task.projectId == projectId,
                  detail.task.id == taskId,
                  detail.task.runId == response.id,
                  detail.activity.protocolVersion == 1,
                  detail.activity.projectId == projectId,
                  detail.activity.taskId == taskId,
                  detail.activity.items.allSatisfy({ item in
                      item.projectId == projectId && item.taskId == taskId
                  }),
                  detail.interaction?.runId == nil || detail.interaction?.runId == response.id else {
                return
            }

            currentTaskActivity = detail.activity
            currentTaskInteraction = ProjectTaskInteractionControl.reconcile(
                detail,
                previous: currentTaskInteraction
            )
        } catch APIClientError.httpStatus(let status, let message) where status == 403 || status == 404 {
            currentTaskActivity = nil
            if var control = currentTaskInteraction,
               control.task.projectId == projectId,
               control.task.id == taskId {
                control.submission = .failed(message: message, retryable: false)
                currentTaskInteraction = control
            }
        } catch {
            self.error = "Task controls could not be refreshed: \(error.localizedDescription)"
        }
    }

    private func refreshConnectorApproval(response: PlatformResponse, conversationId: String) async {
        guard let conversation = currentConversation, conversation.id == conversationId,
              let candidate = ConnectorApprovalCandidate.latest(in: conversation.messages, response: response) else {
            currentConnectorApproval = nil
            return
        }

        if currentConnectorApproval?.approval.id != candidate.approvalId {
            currentConnectorApproval = nil
        }

        do {
            guard let apiClient else {
                return
            }

            let approval = try await apiClient.fetchConnectorApproval(id: candidate.approvalId)

            guard currentConversation?.id == conversationId,
                  currentConversation?.latestResponse?.id == response.id,
                  approval.id == candidate.approvalId,
                  approval.runId == response.id,
                  approval.completionId == conversationId,
                  approval.provider == candidate.provider,
                  approval.operation == candidate.operation else {
                currentConnectorApproval = nil
                return
            }

            currentConnectorApproval = ConnectorApprovalControl.reconcile(
                approval,
                previous: currentConnectorApproval
            )
        } catch APIClientError.httpStatus(let status, let message) where status == 403 || status == 404 {
            if var control = currentConnectorApproval,
               control.approval.id == candidate.approvalId {
                control.submission = .failed(message: message, retryable: false)
                currentConnectorApproval = control
            }
        } catch {
            self.error = "Connector approval could not be refreshed: \(error.localizedDescription)"
        }
    }

    private func setTaskInteractionSubmission(
        _ submission: ProjectTaskInteractionSubmission,
        interactionId: String
    ) {
        guard var control = currentTaskInteraction,
              control.interaction.interactionId == interactionId else {
            return
        }

        control.submission = submission
        currentTaskInteraction = control
    }

    private func setConnectorApprovalSubmission(
        _ submission: ProjectTaskInteractionSubmission,
        approvalId: String
    ) {
        guard var control = currentConnectorApproval, control.approval.id == approvalId else {
            return
        }

        control.submission = submission
        currentConnectorApproval = control
    }

    private func reconcileTaskInteractionFailure(
        _ error: Error,
        control: ProjectTaskInteractionControl
    ) async {
        let interactionId = control.interaction.interactionId

        if case APIClientError.httpStatus(let status, let message) = error {
            if status == 409 {
                setTaskInteractionSubmission(.resolvedElsewhere, interactionId: interactionId)
                await refreshCurrentTaskInteraction()
                return
            }

            if status == 403 || status == 404 {
                setTaskInteractionSubmission(
                    .failed(message: message, retryable: false),
                    interactionId: interactionId
                )
                return
            }
        }

        await refreshCurrentTaskInteraction()

        if let current = currentTaskInteraction,
           current.interaction.interactionId == interactionId,
           (current.submission == .acknowledged || current.submission == .resolvedElsewhere) {
            return
        }

        setTaskInteractionSubmission(
            .failed(message: error.localizedDescription, retryable: true),
            interactionId: interactionId
        )
    }

    private func reconcileConnectorApprovalFailure(
        _ error: Error,
        control: ConnectorApprovalControl
    ) async {
        let approvalId = control.approval.id

        if case APIClientError.httpStatus(let status, let message) = error {
            if status == 404 {
                setConnectorApprovalSubmission(.resolvedElsewhere, approvalId: approvalId)
                await refreshCurrentConnectorApproval()
                return
            }

            if status == 403 {
                setConnectorApprovalSubmission(
                    .failed(message: message, retryable: false),
                    approvalId: approvalId
                )
                return
            }
        }

        await refreshCurrentConnectorApproval()

        if let current = currentConnectorApproval,
           current.approval.id == approvalId,
           (current.submission == .acknowledged || current.submission == .resolvedElsewhere) {
            return
        }

        setConnectorApprovalSubmission(
            .failed(message: error.localizedDescription, retryable: true),
            approvalId: approvalId
        )
    }

    func deleteConversation(_ conversation: Conversation) async {
        if conversation.isLoadedFromAPI {
            do {
                try await apiClient?.deleteConversation(id: conversation.id)
            } catch {
                self.error = "Failed to delete conversation: \(error.localizedDescription)"
                return
            }
        }

        conversations.removeAll { $0.id == conversation.id }
        knownConversations.removeValue(forKey: conversation.id)

        if currentConversation?.id == conversation.id {
            currentConversation = nil
            currentTaskInteraction = nil
            currentTaskActivity = nil
            currentConnectorApproval = nil
        }
    }
}

enum TurnRequestKind {
    case message
    case connectorApproval(String)
    case approvals(responseId: String, decisions: [ToolApprovalDecision])
}
