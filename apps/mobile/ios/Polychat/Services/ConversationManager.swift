import Foundation
import Combine

class ConversationManager: ObservableObject {
    @Published var currentConversation: Conversation?
    @Published var conversations: [Conversation] = []
    
    private var apiClient: APIClient?
    private var authManager: AuthenticationManager?
    
    func configure(apiClient: APIClient, authManager: AuthenticationManager) {
        self.apiClient = apiClient
        self.authManager = authManager

        if currentConversation == nil {
            _ = startNewConversation()
        }
    }
    
    func startNewConversation() -> Conversation {
        let newConversation = Conversation(id: UUID().uuidString, 
                                         title: "New Conversation",
                                         messages: [],
                                         createdAt: Date())
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
            // Get API response
            if let response = try await apiClient?.createChatCompletion(messages: conversation.messages.dropLast()) {
                // Remove loading message
                conversation.messages.removeLast()
                
                let assistantMessage = ChatMessage(role: "assistant", 
                                                 content: response.choices.first?.message.content ?? "No response")
                conversation.messages.append(assistantMessage)
                currentConversation = conversation
                updateConversationInArray(conversation)
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
}

struct Conversation: Identifiable {
    let id: String
    var title: String
    var messages: [ChatMessage]
    let createdAt: Date
}
