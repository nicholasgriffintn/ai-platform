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

        // Load conversations from API on startup
        Task {
            await loadConversations()
        }
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

            // Convert API response to local Conversation models
            conversations = response.data.map { summary in
                Conversation(
                    id: summary.id,
                    title: summary.title ?? "New Conversation",
                    messages: [], // Messages loaded on demand
                    createdAt: ISO8601DateFormatter().date(from: summary.createdAt) ?? Date(),
                    modelId: summary.model,
                    isLoadedFromAPI: true
                )
            }

            // If no current conversation, start a new one
            if currentConversation == nil && conversations.isEmpty {
                _ = startNewConversation()
            }
        } catch {
            self.error = "Failed to load conversations: \(error.localizedDescription)"
            // Create a new conversation as fallback
            if conversations.isEmpty {
                _ = startNewConversation()
            }
        }

        isLoading = false
    }

    func refreshConversations() async {
        await loadConversations()
    }
    
    func loadConversationMessages(_ conversation: Conversation) async {
        // If messages already loaded, skip
        if !conversation.messages.isEmpty {
            currentConversation = conversation
            return
        }

        guard let apiClient = apiClient, conversation.isLoadedFromAPI else {
            currentConversation = conversation
            return
        }

        do {
            let detail = try await apiClient.fetchConversation(id: conversation.id)

            // Update conversation with messages
            var updatedConversation = conversation
            updatedConversation.messages = detail.messages
            updatedConversation.title = detail.title ?? conversation.title

            // Update in array
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
            isLoadedFromAPI: false
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

        // Add user message
        conversation.messages.append(message)
        currentConversation = conversation
        updateConversationInArray(conversation)

        // Add loading indicator
        let loadingMessage = ChatMessage(role: "assistant", content: "...")
        conversation.messages.append(loadingMessage)
        currentConversation = conversation
        updateConversationInArray(conversation)

        do {
            // Get the model to use - from conversation, selected, or default
            let currentSelectedModelId = await MainActor.run { modelsStore?.selectedModelId }
            let modelToUse = conversation.modelId ??
                           selectedModelId ??
                           currentSelectedModelId ??
                           "mistral-small"

            // Get API response with store:true, completion_id, and settings
            if let response = try await apiClient?.createChatCompletion(
                messages: Array(conversation.messages.dropLast()),
                modelId: modelToUse,
                completionId: conversation.id,
                settings: settings
            ) {
                // Remove loading message
                conversation.messages.removeLast()

                let contentText = response.choices.first?.message.content.textValue ?? "No response"
                let assistantMessage = ChatMessage(role: "assistant",
                                                 content: contentText)
                conversation.messages.append(assistantMessage)
                currentConversation = conversation
                updateConversationInArray(conversation)
                
                // Generate title if needed
                await generateTitleIfNeeded(for: conversation)
            }
        } catch {
            // Remove loading message and add error message
            conversation.messages.removeLast()
            let errorMessage = ChatMessage(role: "assistant", content: "Error: \(error.localizedDescription)")
            conversation.messages.append(errorMessage)
            currentConversation = conversation
            updateConversationInArray(conversation)
        }
    }
    
    private func updateConversationInArray(_ conversation: Conversation) {
        if let index = conversations.firstIndex(where: { $0.id == conversation.id }) {
            conversations[index] = conversation
        }
    }
    
    func setModelForCurrentConversation(_ modelId: String) {
        selectedModelId = modelId
        currentConversation?.modelId = modelId
        if let conversation = currentConversation {
            updateConversationInArray(conversation)
        }
    }
    
    func generateTitleIfNeeded(for conversation: Conversation) async {
        // Only generate title if we have at least 2 messages and the title is still default
        guard conversation.messages.count >= 2,
              conversation.title == "New Conversation" || conversation.title.hasPrefix("New Conversation") else {
            return
        }
        
        do {
            let titleResponse = try await apiClient?.generateTitle(conversationId: conversation.id, messages: conversation.messages)
            if let title = titleResponse?.data?.title {
                await updateConversationTitle(conversation.id, title: title)
            }
        } catch {
            // If title generation fails, use truncated first message as fallback
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

            // Update on server if it's from API
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
        // Delete from server if it's from API
        if conversation.isLoadedFromAPI {
            do {
                try await apiClient?.deleteConversation(id: conversation.id)
            } catch {
                self.error = "Failed to delete conversation: \(error.localizedDescription)"
                return
            }
        }

        // Remove from local array
        if let index = conversations.firstIndex(where: { $0.id == conversation.id }) {
            conversations.remove(at: index)
        }

        // Clear current if deleted
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

    static func == (lhs: Conversation, rhs: Conversation) -> Bool {
        return lhs.id == rhs.id
    }
}
