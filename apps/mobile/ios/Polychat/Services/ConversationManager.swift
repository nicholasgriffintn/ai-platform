import Foundation
import Combine

@MainActor
class ConversationManager: ObservableObject {
    @Published var currentConversation: Conversation?
    @Published var conversations: [Conversation] = []
    @Published var selectedModelId: String?
    @Published var isLoading: Bool = false
    @Published var loadingConversationID: String?
    @Published var error: String?

    private var apiClient: (any ConversationAPIClient)?
    private var modelsStore: ModelsStore?

    func configure(apiClient: any ConversationAPIClient, modelsStore: ModelsStore? = nil) {
        self.apiClient = apiClient
        self.modelsStore = modelsStore
    }

    func reset() {
        currentConversation = nil
        conversations = []
        selectedModelId = nil
        isLoading = false
        loadingConversationID = nil
        error = nil
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

            var updatedConversation = conversation
            updatedConversation.messages = detail.messages
            updatedConversation.title = detail.title ?? conversation.title
            updatedConversation.modelId = detail.model
            updatedConversation.lastMessageAt = AppDateParser.parse(detail.lastMessageAt ?? detail.updatedAt)
            updatedConversation.messageCount = detail.messageCount ?? detail.messages.count

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

    func regenerateAssistantMessage(_ messageId: String, settings: ChatSettings? = nil) async {
        guard var conversation = currentConversation,
              let messageIndex = conversation.messages.firstIndex(where: { $0.id == messageId }) else {
            error = "Unable to retry: message not found"
            return
        }

        let message = conversation.messages[messageIndex]
        let retryEndIndex: Int

        if message.role == "assistant" {
            retryEndIndex = messageIndex
        } else if message.role == "user" {
            retryEndIndex = messageIndex + 1
        } else {
            error = "Only user and assistant messages can be retried"
            return
        }

        let requestMessages = Array(conversation.messages.prefix(retryEndIndex))
        guard requestMessages.contains(where: { $0.role == "user" }) else {
            error = "Unable to retry without a user message"
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
        generateTitle: Bool
    ) async {
        guard var conversation = conversations.first(where: { $0.id == conversationId }) else {
            return
        }

        let assistantMessageId = UUID().uuidString
        let loadingMessage = ChatMessage(id: assistantMessageId, role: "assistant", content: "")
        conversation.messages.append(loadingMessage)
        conversation.lastMessageAt = Date()
        conversation.messageCount = conversation.messages.count
        currentConversation = conversation
        updateConversationInArray(conversation)

        var finalMessageId = assistantMessageId
        var didReceiveStreamEvent = false

        do {
            let currentSelectedModelId = await MainActor.run { modelsStore?.selectedModelId }
            let modelToUse = conversation.modelId ??
                           selectedModelId ??
                           currentSelectedModelId ??
                           "mistral-small"
            let providerToUse = modelsStore?.model(withId: modelToUse)?.provider

            guard let apiClient else {
                throw NSError(domain: "com.polychat.app", code: 1,
                             userInfo: [NSLocalizedDescriptionKey: "API client not configured"])
            }

            let stream = apiClient.streamChatCompletion(
                messages: requestMessages,
                modelId: modelToUse,
                provider: providerToUse,
                completionId: conversationId,
                settings: settings
            )

            var streamedContent = ""
            var streamedReasoning = ""
            var responseModelId = modelToUse

            for try await event in stream {
                didReceiveStreamEvent = true
                switch event {
                case .content(let delta):
                    streamedContent += delta
                    updateAssistantMessage(
                        conversationId: conversationId,
                        messageId: finalMessageId,
                        content: streamedContent,
                        modelId: responseModelId,
                        fallbackMessageId: assistantMessageId
                    )
                case .reasoning(let delta):
                    streamedReasoning += delta
                    if streamedContent.isEmpty {
                        updateAssistantMessage(
                            conversationId: conversationId,
                            messageId: finalMessageId,
                            content: "<think>\n\(streamedReasoning)",
                            modelId: responseModelId,
                            fallbackMessageId: assistantMessageId
                        )
                    }
                case .state:
                    break
                case .metadata(let metadata):
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
            }

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

            if generateTitle,
               let updatedConversation = currentConversation,
               updatedConversation.id == conversationId {
                await generateTitleIfNeeded(for: updatedConversation)
            }
        } catch {
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
        conversation.messages[messageIndex] = ChatMessage(
            id: messageId,
            role: "assistant",
            content: content,
            model: modelId ?? existingMessage.model,
            parts: metadata?.parts ?? existingMessage.parts,
            reasoning: metadata?.reasoning ?? existingMessage.reasoning,
            citations: metadata?.citations ?? existingMessage.citations,
            data: metadata?.data ?? existingMessage.data,
            name: metadata?.name ?? existingMessage.name,
            status: metadata?.status ?? existingMessage.status,
            logId: metadata?.logId ?? existingMessage.logId,
            created: created,
            timestamp: created ?? existingMessage.timestamp
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
    
    func updateConversationTitle(_ conversationId: String, title: String) async {
        if let index = conversations.firstIndex(where: { $0.id == conversationId }) {
            conversations[index].title = title
            if currentConversation?.id == conversationId {
                currentConversation?.title = title
            }

            if conversations[index].isLoadedFromAPI {
                do {
                    try await apiClient?.updateConversation(id: conversationId, title: title)
                } catch {
                    self.error = "Failed to update title: \(error.localizedDescription)"
                }
            }
        }
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
        }
    }
}
