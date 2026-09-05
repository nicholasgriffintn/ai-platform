import Foundation
import Combine

@MainActor
class ConversationManager: ObservableObject {
    @Published var currentConversation: Conversation?
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

    private var apiClient: (any ConversationAPIClient)?
    private var modelsStore: ModelsStore?
    private var turnRecoveryPolicy = TurnRecoveryPolicy()

    func configure(
        apiClient: any ConversationAPIClient,
        modelsStore: ModelsStore? = nil,
        turnRecoveryPolicy: TurnRecoveryPolicy = TurnRecoveryPolicy()
    ) {
        self.apiClient = apiClient
        self.modelsStore = modelsStore
        self.turnRecoveryPolicy = turnRecoveryPolicy
    }

    func reset() {
        currentConversation = nil
        conversations = []
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
    }

    func loadConversations() async {
        isLoading = true
        error = nil

        do {
            guard let apiClient = apiClient else {
                throw NSError(domain: "com.polychat.app", code: 1,
                             userInfo: [NSLocalizedDescriptionKey: "API client not configured"])
            }

            let response = try await apiClient.fetchConversations()

            conversations = response.conversations.map { summary in
                Conversation(
                    id: summary.id,
                    title: summary.title ?? "New Conversation",
                    messages: [],
                    createdAt: AppDateParser.parse(summary.createdAt, fallback: Date()),
                    modelId: summary.model,
                    isLoadedFromAPI: true,
                    lastMessageAt: AppDateParser.parse(summary.lastMessageAt ?? summary.updatedAt),
                    messageCount: summary.messageCount ?? summary.messages.count
                )
            }

            if currentConversation == nil && conversations.isEmpty {
                _ = startNewConversation()
            }
        } catch {
            self.error = "Failed to load conversations: \(error.localizedDescription)"
            if conversations.isEmpty {
                _ = startNewConversation()
            }
        }

        isLoading = false
    }

    func refreshConversations() async {
        await loadConversations()
    }

    func loadConversationMessages(id conversationId: String) async {
        guard let conversation = conversations.first(where: { $0.id == conversationId }) else {
            return
        }

        await loadConversationMessages(conversation)
    }
    
    func loadConversationMessages(_ conversation: Conversation) async {
        guard !Task.isCancelled else {
            return
        }

        let shouldLoadMessages = conversation.messages.isEmpty && conversation.isLoadedFromAPI
        loadingConversationID = shouldLoadMessages ? conversation.id : nil
        if currentConversation?.id != conversation.id {
            currentTaskInteraction = nil
            currentTaskActivity = nil
            currentConnectorApproval = nil
        }
        currentConversation = conversation

        if !conversation.messages.isEmpty {
            return
        }

        guard let apiClient = apiClient, conversation.isLoadedFromAPI else {
            if loadingConversationID == conversation.id {
                loadingConversationID = nil
            }
            return
        }

        do {
            let detail = try await apiClient.fetchConversation(id: conversation.id)
            guard !Task.isCancelled else {
                if loadingConversationID == conversation.id {
                    loadingConversationID = nil
                }
                return
            }

            let updatedConversation = applying(detail, to: conversation)

            if let index = conversations.firstIndex(where: { $0.id == conversation.id }) {
                conversations[index] = updatedConversation
            }

            if loadingConversationID == conversation.id || currentConversation?.id == conversation.id {
                currentConversation = updatedConversation
            }
        } catch is CancellationError {
            if loadingConversationID == conversation.id {
                loadingConversationID = nil
            }
            return
        } catch {
            self.error = "Failed to load conversation: \(error.localizedDescription)"
            if loadingConversationID == conversation.id || currentConversation?.id == conversation.id {
                currentConversation = conversation
            }
        }

        if loadingConversationID == conversation.id {
            loadingConversationID = nil
        }
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
            updateConversationInArray(conversation)

            if currentConversation?.id == conversation.id {
                currentConversation = conversation
            }
        } catch {
            self.error = "Failed to load earlier messages: \(error.localizedDescription)"
        }
    }

    func observeCurrentRun() async {
        var replayState: ChatRunReplayState?

        while !Task.isCancelled {
            guard let apiClient,
                  let conversation = currentConversation,
                  let run = conversation.latestRun else {
                return
            }

            await refreshProjectTaskInteraction(run: run, conversationId: conversation.id)
            await refreshConnectorApproval(run: run, conversationId: conversation.id)

            guard run.isActive else {
                return
            }

            do {
                if replayState == nil {
                    let snapshot = try await apiClient.fetchChatRunSnapshot(id: run.id)
                    replayState = ChatRunReplayState(cursor: snapshot.cursor, snapshot: snapshot)
                } else if let currentState = replayState {
                    let replay = try await apiClient.fetchChatRunEvents(
                        id: run.id,
                        after: currentState.cursor
                    )
                    let outcome = ChatRunReplay.apply(state: currentState, response: replay)

                    if outcome.requiresSnapshot {
                        let snapshot = try await apiClient.fetchChatRunSnapshot(id: run.id)
                        replayState = ChatRunReplayState(cursor: snapshot.cursor, snapshot: snapshot)
                    } else {
                        replayState = outcome.state
                    }
                }

                guard currentConversation?.id == conversation.id,
                      currentConversation?.latestRun?.id == run.id,
                      let replayState else {
                    return
                }

                _ = applyRunSnapshot(
                    conversationId: conversation.id,
                    snapshot: replayState.snapshot.recoveryResponse
                )

                if replayState.snapshot.run.isTerminal {
                    return
                }
            } catch {
                self.error = "Task status could not be refreshed: \(error.localizedDescription)"
            }

            do {
                try await turnRecoveryPolicy.sleep(turnRecoveryPolicy.pollInterval)
            } catch {
                return
            }
        }
    }

    func refreshCurrentTaskInteraction() async {
        guard let conversation = currentConversation, let run = conversation.latestRun else {
            currentTaskInteraction = nil
            currentTaskActivity = nil
            return
        }

        await refreshProjectTaskInteraction(run: run, conversationId: conversation.id)
    }

    func refreshCurrentConnectorApproval() async {
        guard let conversation = currentConversation, let run = conversation.latestRun else {
            currentConnectorApproval = nil
            return
        }

        await refreshConnectorApproval(run: run, conversationId: conversation.id)
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
                    connectorApprovalId: approvalId
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
            connectorApprovalId: control.approval.id
        )
        await refreshCurrentConnectorApproval()
    }

    func cancelCurrentRun() async {
        guard let apiClient,
              let conversation = currentConversation,
              let run = conversation.latestRun,
              run.isActive else {
            return
        }

        do {
            let receipt = try await apiClient.cancelChatRun(
                id: run.id,
                expectedAttempt: run.attempt
            )
            guard currentConversation?.id == conversation.id,
                  currentConversation?.latestRun?.id == run.id,
                  currentConversation?.latestRun?.attempt == run.attempt else {
                return
            }

            updateRun(receipt.run, conversationId: conversation.id)
        } catch {
            self.error = "The task could not be stopped: \(error.localizedDescription)"
        }
    }

    func startNewConversation() -> Conversation {
        let modelId = selectedModelId ?? modelsStore?.selectedModelId
        let newConversation = Conversation(
            id: UUID().uuidString,
            title: "New Conversation",
            messages: [],
            createdAt: Date(),
            modelId: modelId,
            isLoadedFromAPI: false,
            lastMessageAt: nil,
            messageCount: 0
        )
        currentTaskInteraction = nil
        currentTaskActivity = nil
        currentConnectorApproval = nil
        currentConversation = newConversation
        conversations.insert(newConversation, at: 0)
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
        currentConversation = conversation
        updateConversationInArray(conversation)

        await generateAssistantResponse(
            conversationId: conversation.id,
            requestMessages: conversation.messages,
            settings: settings,
            generateTitle: true
        )
    }


    func branchConversation(from messageId: String, settings: ChatSettings? = nil) async {
        guard let parentConversation = currentConversation else {
            error = "Unable to branch: conversation not found"
            return
        }

        guard let messageIndex = parentConversation.messages.firstIndex(where: { $0.id == messageId }) else {
            error = "Unable to branch: message not found"
            return
        }

        let branchMessage = parentConversation.messages[messageIndex]
        guard !branchMessage.isCompactionMarker,
              branchMessage.role == "user" || branchMessage.role == "assistant" else {
            error = "Only user and assistant messages can start a branch"
            return
        }

        let branchId = UUID().uuidString
        let branchMessages = parentConversation.messages
            .prefix(messageIndex + 1)
            .map { $0.replacingCompletionId(with: branchId) }
        var branch = Conversation(
            id: branchId,
            title: parentConversation.title.isEmpty ? "Branched Conversation" : parentConversation.title,
            messages: branchMessages,
            createdAt: Date(),
            modelId: parentConversation.modelId,
            isLoadedFromAPI: false,
            lastMessageAt: Date(),
            messageCount: branchMessages.count
        )

        conversations.insert(branch, at: 0)
        currentConversation = branch

        if parentConversation.isLoadedFromAPI {
            do {
                guard let apiClient else {
                    throw NSError(domain: "com.polychat.app", code: 1,
                                  userInfo: [NSLocalizedDescriptionKey: "API client not configured"])
                }

                try await apiClient.updateConversation(
                    id: branchId,
                    title: branch.title,
                    messages: branchMessages,
                    parentConversationId: parentConversation.id,
                    parentMessageId: messageId
                )
                branch.isLoadedFromAPI = true
                updateConversationInArray(branch)
                if currentConversation?.id == branchId {
                    currentConversation = branch
                }
            } catch {
                self.error = "Branch was created locally, but could not be synced: \(error.localizedDescription)"
            }
        }

        if branchMessage.role == "user" {
            await generateAssistantResponse(
                conversationId: branchId,
                requestMessages: branchMessages,
                settings: settings,
                generateTitle: true
            )
        }
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
            retryEndIndex = messageIndex
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
        currentConversation = conversation
        updateConversationInArray(conversation)

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
        connectorApprovalId: String? = nil
    ) async {
        guard var conversation = conversations.first(where: { $0.id == conversationId }) else {
            return
        }

        let commandId = UUID().uuidString
        var observedRun = conversation.latestRun
        let knownAssistantCount = conversation.messages.filter { $0.role == "assistant" }.count
        var toolActivity = StreamingToolActivity()
        turnActivities[conversationId] = TurnActivityProjection()
        defer { turnActivities.removeValue(forKey: conversationId) }

        let assistantMessageId = UUID().uuidString
        let loadingMessage = ChatMessage(
            id: assistantMessageId,
            role: "assistant",
            content: "",
            completionId: conversationId,
            status: "in_progress"
        )
        conversation.messages.append(loadingMessage)
        conversation.lastMessageAt = Date()
        conversation.messageCount = conversation.messages.count
        if currentConversation?.id == conversationId {
            currentConversation = conversation
        }
        updateConversationInArray(conversation)

        var finalMessageId = assistantMessageId
        var didReceiveStreamEvent = false
        var streamedContent = ""
        var progressCoalescer: ChatStreamProgressCoalescer?

        defer {
            progressCoalescer?.stop()
        }

        do {
            let currentSelectedModelId = await MainActor.run { modelsStore?.selectedModelId }
            let requestedModelId = conversation.modelId ?? selectedModelId ?? currentSelectedModelId
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
            let modelToUse = selectedModel?.id
            let providerToUse = selectedModel?.provider

            guard let apiClient else {
                throw NSError(domain: "com.polychat.app", code: 1,
                             userInfo: [NSLocalizedDescriptionKey: "API client not configured"])
            }

            let stream = connectorApprovalId.map {
                apiClient.streamApprovedConnectorOperation(
                    messages: requestMessages,
                    modelId: modelToUse,
                    provider: providerToUse,
                    completionId: conversationId,
                    settings: settings,
                    approvalId: $0,
                    commandId: commandId
                )
            } ?? apiClient.streamChatCompletion(
                messages: requestMessages,
                modelId: modelToUse,
                provider: providerToUse,
                completionId: conversationId,
                settings: settings,
                commandId: commandId
            )

            var streamedReasoning = ""
            var responseModelId = modelToUse ?? "auto"
            var responsivenessGate = ChatStreamResponsivenessGate()
            progressCoalescer = ChatStreamProgressCoalescer { [weak self] update in
                self?.updateAssistantMessage(
                    conversationId: update.conversationId,
                    messageId: update.messageId,
                    content: update.content,
                    modelId: update.modelId,
                    fallbackMessageId: update.fallbackMessageId
                )
            }

            for try await event in stream {
                didReceiveStreamEvent = true

                if !event.isProgressDelta {
                    progressCoalescer?.flush()
                }

                switch event {
                case .content(let delta):
                    completePendingCompactionMessage(conversationId: conversationId)
                    streamedContent += delta
                    progressCoalescer?.update(ChatStreamProgressUpdate(
                        conversationId: conversationId,
                        messageId: finalMessageId,
                        content: streamedContent,
                        modelId: responseModelId,
                        fallbackMessageId: assistantMessageId
                    ))
                case .reasoning(let delta):
                    completePendingCompactionMessage(conversationId: conversationId)
                    streamedReasoning += delta
                    if streamedContent.isEmpty {
                        progressCoalescer?.update(ChatStreamProgressUpdate(
                            conversationId: conversationId,
                            messageId: finalMessageId,
                            content: "<think>\n\(streamedReasoning)",
                            modelId: responseModelId,
                            fallbackMessageId: assistantMessageId
                        ))
                    }
                case .state(let state):
                    if state == "compaction" {
                        insertPendingCompactionMessage(
                            conversationId: conversationId,
                            beforeMessageId: assistantMessageId
                        )
                    }
                case .run(let receipt):
                    observedRun = receipt.run
                    updateRun(receipt.run, conversationId: conversationId)
                case .toolUseStart(let toolCall):
                    toolActivity.start(toolCall)
                case .toolUseDelta(let toolCall):
                    toolActivity.applyDelta(toolCall)
                case .toolUseStop(let toolCallId):
                    if let update = toolActivity.stop(toolCallId: toolCallId, completionId: conversationId) {
                        applyToolActivityUpdate(
                            update,
                            conversationId: conversationId,
                            beforeMessageId: assistantMessageId
                        )
                    }
                case .toolResult(let result):
                    if let update = toolActivity.resolve(result, completionId: conversationId) {
                        applyToolActivityUpdate(
                            update,
                            conversationId: conversationId,
                            beforeMessageId: assistantMessageId
                        )
                    }
                case .turnActivity(let event):
                    var projection = turnActivities[conversationId] ?? TurnActivityProjection()
                    projection.apply(event)
                    turnActivities[conversationId] = projection
                case .usageLimits(let limits):
                    usageLimits = limits
                case .conversationTitle(let title):
                    applyConversationTitle(conversationId, title: title)
                case .compaction(let message):
                    insertCompactionMessage(
                        conversationId: conversationId,
                        message: message,
                        beforeMessageId: assistantMessageId
                    )
                case .metadata(let metadata):
                    completePendingCompactionMessage(conversationId: conversationId)
                    if let model = metadata.model {
                        responseModelId = model
                    }
                    if let messageId = metadata.messageId {
                        finalMessageId = messageId
                    }
                    if let content = metadata.content, !content.isEmpty {
                        streamedContent = content
                    }
                    updateAssistantMessage(
                        conversationId: conversationId,
                        messageId: finalMessageId,
                        content: streamedContent,
                        modelId: responseModelId,
                        metadata: metadata,
                        fallbackMessageId: assistantMessageId
                    )
                case .done:
                    break
                }

                if responsivenessGate.shouldYield(after: event) {
                    await Task.yield()
                }
            }

            progressCoalescer?.flush()
            completePendingCompactionMessage(conversationId: conversationId)
            removeMessages(conversationId: conversationId, ids: toolActivity.interimMessageIds)

            if streamedContent.isEmpty {
                streamedContent = streamedReasoning.isEmpty ? "No response" : "<think>\n\(streamedReasoning)"
                updateAssistantMessage(
                    conversationId: conversationId,
                    messageId: finalMessageId,
                    content: streamedContent,
                    modelId: responseModelId,
                    fallbackMessageId: assistantMessageId
                )
            }

            if let detail = try? await apiClient.fetchConversation(
                id: conversationId,
                refreshPending: false
            ), let storedConversation = conversations.first(where: { $0.id == conversationId }) {
                let refreshedConversation = applying(detail, to: storedConversation)
                updateConversationInArray(refreshedConversation)

                if currentConversation?.id == conversationId {
                    currentConversation = refreshedConversation
                }
            }

            if generateTitle,
               let updatedConversation = currentConversation,
               updatedConversation.id == conversationId {
                await generateTitleIfNeeded(for: updatedConversation)
            }
        } catch {
            removePendingCompactionMessages(conversationId: conversationId)
            removeMessages(conversationId: conversationId, ids: toolActivity.interimMessageIds)

            let recovered = await recoverDetachedTurn(
                error: error,
                conversationId: conversationId,
                commandId: commandId,
                runId: observedRun?.id,
                knownAssistantCount: knownAssistantCount,
                assistantMessageId: finalMessageId,
                fallbackMessageId: assistantMessageId,
                modelId: conversation.modelId,
                streamedContent: streamedContent
            )

            if recovered {
                if generateTitle,
                   let updatedConversation = currentConversation,
                   updatedConversation.id == conversationId {
                    await generateTitleIfNeeded(for: updatedConversation)
                }
                return
            }

            updateAssistantMessage(
                conversationId: conversationId,
                messageId: finalMessageId,
                content: "Error: \(error.localizedDescription)",
                modelId: conversation.modelId,
                fallbackMessageId: assistantMessageId,
                markLoadedFromAPI: didReceiveStreamEvent
            )
        }
    }

    private func recoverDetachedTurn(
        error: Error,
        conversationId: String,
        commandId: String,
        runId: String?,
        knownAssistantCount: Int,
        assistantMessageId: String,
        fallbackMessageId: String,
        modelId: String?,
        streamedContent: String
    ) async -> Bool {
        guard StreamFailureClassifier.classify(error) == .transport, let apiClient else {
            return false
        }

        var projection = turnActivities[conversationId] ?? TurnActivityProjection()
        projection.markReconnecting()
        turnActivities[conversationId] = projection

        updateAssistantMessage(
            conversationId: conversationId,
            messageId: assistantMessageId,
            content: streamedContent.isEmpty
                ? TurnRecoveryStatus.reconnecting
                : streamedContent + TurnRecoveryStatus.reconnectingNotice,
            modelId: modelId,
            fallbackMessageId: fallbackMessageId,
            markLoadedFromAPI: false
        )

        let snapshot = await TurnRecovery.recoverDetachedTurn(
            runId: runId,
            knownAssistantCount: knownAssistantCount,
            policy: turnRecoveryPolicy,
            resolveCommand: {
                try await apiClient.fetchChatRunCommand(id: commandId).run.id
            },
            fetchRun: { runId, recovery in
                try await apiClient.fetchChatRun(id: runId, recovery: recovery)
            }
        )

        guard let snapshot else {
            return false
        }

        return applyRunSnapshot(
            conversationId: conversationId,
            snapshot: snapshot,
            placeholderIds: [assistantMessageId, fallbackMessageId]
        )
    }

    func turnActivityLabel(for conversationId: String?) -> String? {
        guard let conversationId else {
            return nil
        }

        return turnActivities[conversationId]?.label
    }

    private func applyRunSnapshot(
        conversationId: String,
        snapshot: ChatRunRecoveryResponse,
        placeholderIds: Set<String> = []
    ) -> Bool {
        guard let index = conversations.firstIndex(where: { $0.id == conversationId }) else {
            return false
        }

        var conversation = conversations[index]
        let authoritativeIds = Set(snapshot.messages.map(\.id))
        conversation.messages.removeAll { message in
            !authoritativeIds.contains(message.id)
                && (placeholderIds.contains(message.id) || message.runId == snapshot.run.id)
        }

        for message in snapshot.messages {
            if let messageIndex = conversation.messages.firstIndex(where: { $0.id == message.id }) {
                conversation.messages[messageIndex] = message
            } else {
                conversation.messages.append(message)
            }
        }

        conversation.latestRun = snapshot.run
        conversation.isLoadedFromAPI = true
        conversation.messageCount = conversation.messages.count
        conversation.lastMessageAt = Date()
        conversations[index] = conversation

        if currentConversation?.id == conversationId {
            currentConversation = conversation
        }

        return true
    }

    private func updateRun(_ run: ChatRun, conversationId: String) {
        if let index = conversations.firstIndex(where: { $0.id == conversationId }) {
            conversations[index].latestRun = run
        }
        if currentConversation?.id == conversationId {
            currentConversation?.latestRun = run
        }
    }

    private func applyToolActivityUpdate(
        _ update: StreamingToolActivity.Update,
        conversationId: String,
        beforeMessageId: String
    ) {
        guard let index = conversations.firstIndex(where: { $0.id == conversationId }) else {
            return
        }

        var conversation = conversations[index]
        let replacedIndex = update.replacingMessageId.flatMap { replacingMessageId in
            conversation.messages.firstIndex { $0.id == replacingMessageId }
        } ?? conversation.messages.firstIndex { $0.id == update.message.id }

        if let replacedIndex {
            conversation.messages[replacedIndex] = update.message
        } else {
            let insertionIndex = conversation.messages.firstIndex { $0.id == beforeMessageId }
                ?? conversation.messages.count
            conversation.messages.insert(update.message, at: insertionIndex)
        }

        conversation.messageCount = conversation.messages.count
        conversation.lastMessageAt = Date()
        conversations[index] = conversation

        if currentConversation?.id == conversationId {
            currentConversation = conversation
        }
    }

    private func removeMessages(conversationId: String, ids: [String]) {
        guard !ids.isEmpty,
              let index = conversations.firstIndex(where: { $0.id == conversationId }) else {
            return
        }

        let removableIds = Set(ids)
        var conversation = conversations[index]
        let originalCount = conversation.messages.count
        conversation.messages.removeAll { removableIds.contains($0.id) }

        guard conversation.messages.count != originalCount else {
            return
        }

        conversation.messageCount = conversation.messages.count
        conversations[index] = conversation

        if currentConversation?.id == conversationId {
            currentConversation = conversation
        }
    }

    private func updateAssistantMessage(
        conversationId: String,
        messageId: String,
        content: String,
        modelId: String?,
        metadata: ChatStreamMetadata? = nil,
        fallbackMessageId: String? = nil,
        markLoadedFromAPI: Bool = true
    ) {
        guard let index = conversations.firstIndex(where: { $0.id == conversationId }) else {
            return
        }

        var conversation = conversations[index]
        let messageIndex = assistantMessageIndex(
            in: conversation,
            messageId: messageId,
            fallbackMessageId: fallbackMessageId
        )

        guard let messageIndex else {
            return
        }

        let existingMessage = conversation.messages[messageIndex]
        let created = metadata?.created ?? existingMessage.created
        let contentParts = metadata?.parts ?? existingMessage.parts
        let reasoning = metadata?.reasoning ?? existingMessage.reasoning
        let citations = metadata?.citations ?? existingMessage.citations
        let data = metadata?.data ?? existingMessage.data
        let name = metadata?.name ?? existingMessage.name
        let status = metadata?.status ?? existingMessage.status
        let logId = metadata?.logId ?? existingMessage.logId
        let timestamp = created ?? existingMessage.timestamp

        conversation.messages[messageIndex] = ChatMessage(
            id: messageId,
            role: "assistant",
            content: content,
            model: modelId ?? existingMessage.model,
            parts: contentParts,
            reasoning: reasoning,
            citations: citations,
            data: data,
            completionId: existingMessage.completionId,
            name: name,
            status: status,
            logId: logId,
            created: created,
            timestamp: timestamp
        )
        conversation.isLoadedFromAPI = conversation.isLoadedFromAPI || markLoadedFromAPI
        conversation.modelId = modelId ?? conversation.modelId
        conversation.lastMessageAt = Date()
        conversation.messageCount = conversation.messages.count
        conversations[index] = conversation

        if currentConversation?.id == conversationId {
            currentConversation = conversation
        }
    }

    private func applying(
        _ detail: ConversationDetailResponse,
        to conversation: Conversation
    ) -> Conversation {
        var updatedConversation = conversation

        updatedConversation.messages = detail.messages
        updatedConversation.title = detail.title ?? conversation.title
        updatedConversation.modelId = detail.model
        updatedConversation.lastMessageAt = AppDateParser.parse(detail.lastMessageAt ?? detail.updatedAt)
        updatedConversation.messageCount = detail.messageCount ?? detail.messages.count
        updatedConversation.latestRun = detail.latestRun
        updatedConversation.hasMoreMessages = detail.hasMoreMessages
        updatedConversation.oldestMessageId = detail.oldestMessageId ?? detail.messages.first?.id

        return updatedConversation
    }

    private func insertCompactionMessage(
        conversationId: String,
        message: ChatMessage,
        beforeMessageId: String
    ) {
        guard message.isCompactionMarker,
              let index = conversations.firstIndex(where: { $0.id == conversationId }) else {
            return
        }

        var conversation = conversations[index]
        conversation.messages.removeAll { $0.id == CompactionStatusMarker.pendingId(for: beforeMessageId) }
        conversation.messages.removeAll { $0.id == message.id }
        let insertionIndex = conversation.messages.firstIndex { $0.id == beforeMessageId }
            ?? conversation.messages.count
        conversation.messages.insert(message, at: insertionIndex)
        conversation.messageCount = conversation.messages.count
        conversation.lastMessageAt = Date()
        conversations[index] = conversation

        if currentConversation?.id == conversationId {
            currentConversation = conversation
        }
    }

    private func insertPendingCompactionMessage(
        conversationId: String,
        beforeMessageId: String
    ) {
        guard let index = conversations.firstIndex(where: { $0.id == conversationId }) else {
            return
        }

        let message = compactionStatusMessage(
            id: CompactionStatusMarker.pendingId(for: beforeMessageId),
            completionId: conversationId,
            label: CompactionStatusLabels.automaticPending,
            status: CompactionPartStatus.pending
        )

        var conversation = conversations[index]
        conversation.messages.removeAll { $0.id == message.id }
        let insertionIndex = conversation.messages.firstIndex { $0.id == beforeMessageId }
            ?? conversation.messages.count
        conversation.messages.insert(message, at: insertionIndex)
        conversation.messageCount = conversation.messages.count
        conversation.lastMessageAt = Date()
        conversations[index] = conversation

        if currentConversation?.id == conversationId {
            currentConversation = conversation
        }
    }

    private func completePendingCompactionMessage(conversationId: String) {
        guard let index = conversations.firstIndex(where: { $0.id == conversationId }) else {
            return
        }

        var conversation = conversations[index]
        guard let messageIndex = conversation.messages.firstIndex(where: { message in
            CompactionStatusMarker.isPendingId(message.id)
        }) else {
            return
        }

        conversation.messages[messageIndex] = compactionStatusMessage(
            id: conversation.messages[messageIndex].id,
            completionId: conversationId,
            label: CompactionStatusLabels.automaticCompleted,
            status: CompactionPartStatus.completed
        )
        conversation.lastMessageAt = Date()
        conversations[index] = conversation

        if currentConversation?.id == conversationId {
            currentConversation = conversation
        }
    }

    private func removePendingCompactionMessages(conversationId: String) {
        guard let index = conversations.firstIndex(where: { $0.id == conversationId }) else {
            return
        }

        var conversation = conversations[index]
        let originalCount = conversation.messages.count
        conversation.messages.removeAll { CompactionStatusMarker.isPendingId($0.id) }
        guard conversation.messages.count != originalCount else {
            return
        }

        conversation.messageCount = conversation.messages.count
        conversation.lastMessageAt = Date()
        conversations[index] = conversation

        if currentConversation?.id == conversationId {
            currentConversation = conversation
        }
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
    
    private func assistantMessageIndex(
        in conversation: Conversation,
        messageId: String,
        fallbackMessageId: String?
    ) -> Int? {
        if let index = conversation.messages.lastIndex(where: { $0.id == messageId }) {
            return index
        }

        if let fallbackMessageId,
           let index = conversation.messages.lastIndex(where: { $0.id == fallbackMessageId }) {
            return index
        }

        return fallbackMessageId == nil
            ? conversation.messages.lastIndex(where: { $0.role == "assistant" })
            : nil
    }

    private func updateConversationInArray(_ conversation: Conversation) {
        if let index = conversations.firstIndex(where: { $0.id == conversation.id }) {
            conversations[index] = conversation
        }
    }
    
    func setModelForCurrentConversation(_ modelId: String) {
        selectedModelId = modelId
        modelsStore?.selectModel(modelId)
        currentConversation?.modelId = modelId
        if let conversation = currentConversation {
            updateConversationInArray(conversation)
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
        guard let index = conversations.firstIndex(where: { $0.id == conversationId }) else {
            return
        }

        conversations[index].title = title
        if currentConversation?.id == conversationId {
            currentConversation?.title = title
        }
    }

    func updateConversationTitle(_ conversationId: String, title: String) async {
        applyConversationTitle(conversationId, title: title)

        guard let index = conversations.firstIndex(where: { $0.id == conversationId }),
              conversations[index].isLoadedFromAPI else {
            return
        }

        do {
            try await apiClient?.updateConversation(id: conversationId, title: title)
        } catch {
            self.error = "Failed to update title: \(error.localizedDescription)"
        }
    }

    private func refreshProjectTaskInteraction(run: ChatRun, conversationId: String) async {
        guard let projectId = run.projectId, let taskId = run.projectTaskId else {
            currentTaskInteraction = nil
            currentTaskActivity = nil
            return
        }

        if currentTaskInteraction?.task.projectId != projectId ||
            currentTaskInteraction?.task.id != taskId ||
            (currentTaskInteraction?.interaction.runId != nil &&
                currentTaskInteraction?.interaction.runId != run.id) ||
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
                  currentConversation?.latestRun?.id == run.id,
                  detail.task.projectId == projectId,
                  detail.task.id == taskId,
                  detail.task.runId == run.id,
                  detail.activity.protocolVersion == 1,
                  detail.activity.projectId == projectId,
                  detail.activity.taskId == taskId,
                  detail.activity.items.allSatisfy({ item in
                      item.projectId == projectId && item.taskId == taskId
                  }),
                  detail.interaction?.runId == nil || detail.interaction?.runId == run.id else {
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

    private func refreshConnectorApproval(run: ChatRun, conversationId: String) async {
        guard let conversation = currentConversation, conversation.id == conversationId,
              let candidate = ConnectorApprovalCandidate.latest(in: conversation.messages, run: run) else {
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
                  currentConversation?.latestRun?.id == run.id,
                  approval.id == candidate.approvalId,
                  approval.runId == run.id,
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

        if let index = conversations.firstIndex(where: { $0.id == conversation.id }) {
            conversations.remove(at: index)
        }

        if currentConversation?.id == conversation.id {
            currentConversation = nil
            currentTaskInteraction = nil
            currentTaskActivity = nil
            currentConnectorApproval = nil
        }
    }
}
