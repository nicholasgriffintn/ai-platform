import Foundation
import Combine

@MainActor
class ConversationManager: ObservableObject {
    @Published var currentConversation: Conversation?
    @Published var conversations: [Conversation] = []
    @Published var selectedModelId: String?
    @Published var isLoading: Bool = false
    @Published var error: String?

    private var apiClient: APIClient?
    private var authManager: AuthenticationManager?
    private var modelsStore: ModelsStore?

    func configure(apiClient: APIClient, authManager: AuthenticationManager, modelsStore: ModelsStore? = nil) {
        self.apiClient = apiClient
        self.authManager = authManager
        self.modelsStore = modelsStore
    }

    func reset() {
        currentConversation = nil
        conversations = []
        selectedModelId = nil
        isLoading = false
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
        currentConversation = conversation

        if !conversation.messages.isEmpty {
            return
        }

        guard let apiClient = apiClient, conversation.isLoadedFromAPI else {
            return
        }

        do {
            let detail = try await apiClient.fetchConversation(id: conversation.id)

            var updatedConversation = conversation
            updatedConversation.messages = detail.messages
            updatedConversation.title = detail.title ?? conversation.title
            updatedConversation.modelId = detail.model
            updatedConversation.lastMessageAt = AppDateParser.parse(detail.lastMessageAt ?? detail.updatedAt)
            updatedConversation.messageCount = detail.messageCount ?? detail.messages.count

            if let index = conversations.firstIndex(where: { $0.id == conversation.id }) {
                conversations[index] = updatedConversation
            }

            currentConversation = updatedConversation
        } catch {
            self.error = "Failed to load conversation: \(error.localizedDescription)"
            currentConversation = conversation
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

        let assistantMessageId = UUID().uuidString
        let loadingMessage = ChatMessage(id: assistantMessageId, role: "assistant", content: "")
        conversation.messages.append(loadingMessage)
        currentConversation = conversation
        updateConversationInArray(conversation)

        do {
            let currentSelectedModelId = await MainActor.run { modelsStore?.selectedModelId }
            let modelToUse = conversation.modelId ??
                           selectedModelId ??
                           currentSelectedModelId ??
                           "mistral-small"

            guard let stream = apiClient?.streamChatCompletion(
                messages: Array(conversation.messages.dropLast()),
                modelId: modelToUse,
                completionId: conversation.id,
                settings: settings
            ) else {
                return
            }

            var streamedContent = ""
            var finalMessageId = assistantMessageId

            for try await event in stream {
                switch event {
                case .content(let delta):
                    streamedContent += delta
                    updateAssistantMessage(
                        conversationId: conversation.id,
                        messageId: finalMessageId,
                        content: streamedContent,
                        modelId: modelToUse
                    )
                case .reasoning(let delta):
                    if streamedContent.isEmpty {
                        updateAssistantMessage(
                            conversationId: conversation.id,
                            messageId: finalMessageId,
                            content: delta,
                            modelId: modelToUse
                        )
                    }
                case .state:
                    break
                case .metadata(let messageId):
                    finalMessageId = messageId
                    updateAssistantMessage(
                        conversationId: conversation.id,
                        messageId: finalMessageId,
                        content: streamedContent,
                        modelId: modelToUse
                    )
                case .done:
                    break
                }
            }

            if streamedContent.isEmpty {
                streamedContent = "No response"
                updateAssistantMessage(
                    conversationId: conversation.id,
                    messageId: finalMessageId,
                    content: streamedContent,
                    modelId: modelToUse
                )
            }

            if let updatedConversation = currentConversation, updatedConversation.id == conversation.id {
                await generateTitleIfNeeded(for: updatedConversation)
            }
        } catch {
            updateAssistantMessage(
                conversationId: conversation.id,
                messageId: assistantMessageId,
                content: "Error: \(error.localizedDescription)",
                modelId: conversation.modelId
            )
        }
    }

    private func updateAssistantMessage(
        conversationId: String,
        messageId: String,
        content: String,
        modelId: String?
    ) {
        guard let index = conversations.firstIndex(where: { $0.id == conversationId }) else {
            return
        }

        var conversation = conversations[index]
        guard let messageIndex = conversation.messages.lastIndex(where: { $0.role == "assistant" }) else {
            return
        }

        conversation.messages[messageIndex] = ChatMessage(
            id: messageId,
            role: "assistant",
            content: content,
            model: modelId
        )
        conversation.isLoadedFromAPI = true
        conversation.modelId = modelId
        conversation.lastMessageAt = Date()
        conversation.messageCount = conversation.messages.count
        conversations[index] = conversation

        if currentConversation?.id == conversationId {
            currentConversation = conversation
        }
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

struct Conversation: Identifiable, Equatable {
    let id: String
    var title: String
    var messages: [ChatMessage]
    let createdAt: Date
    var modelId: String?
    var isLoadedFromAPI: Bool
    var lastMessageAt: Date?
    var messageCount: Int

    static func == (lhs: Conversation, rhs: Conversation) -> Bool {
        return lhs.id == rhs.id
    }
}
