import Foundation
import Combine

@MainActor
class ConversationManager: ObservableObject {
    @Published var currentConversation: Conversation?
    @Published var conversations: [Conversation] = []
    @Published var selectedModelId: String?
    
    private var apiClient: APIClient?
    private var authManager: AuthenticationManager?
    private var modelsStore: ModelsStore?
    
    func configure(apiClient: APIClient, authManager: AuthenticationManager, modelsStore: ModelsStore? = nil) {
        self.apiClient = apiClient
        self.authManager = authManager
        self.modelsStore = modelsStore

        if currentConversation == nil {
            _ = startNewConversation()
        }
    }
    
    func startNewConversation() -> Conversation {
        let modelId = selectedModelId ?? modelsStore?.selectedModelId
        let newConversation = Conversation(id: UUID().uuidString, 
                                         title: "New Conversation",
                                         messages: [],
                                         createdAt: Date(),
                                         modelId: modelId)
        currentConversation = newConversation
        conversations.insert(newConversation, at: 0)
        return newConversation
    }
    
    func addMessage(_ message: ChatMessage) async throws {
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
            
            // Get API response
            if let response = try await apiClient?.createChatCompletion(messages: Array(conversation.messages.dropLast()), modelId: modelToUse) {
                // Remove loading message
                conversation.messages.removeLast()
                
                let assistantMessage = ChatMessage(role: "assistant", 
                                                 content: response.choices.first?.message.content ?? "No response")
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
            try await apiClient?.generateTitle(conversationId: conversation.id, messages: conversation.messages)
        } catch {
            // If title generation fails, use truncated first message as fallback
            if let firstUserMessage = conversation.messages.first(where: { $0.role == "user" }) {
                let truncatedTitle = String(firstUserMessage.content.prefix(30))
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
        }
    }
}

struct Conversation: Identifiable, Equatable {
    let id: String
    var title: String
    var messages: [ChatMessage]
    let createdAt: Date
    var modelId: String?
    
    static func == (lhs: Conversation, rhs: Conversation) -> Bool {
        return lhs.id == rhs.id
    }
}
