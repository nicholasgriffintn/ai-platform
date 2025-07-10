import SwiftUI

struct ChatView: View {
    @EnvironmentObject var conversationManager: ConversationManager
    @State private var messageText = ""
    
    private var messages: [ChatMessage] {
        conversationManager.currentConversation?.messages ?? []
    }
    
    var body: some View {
        VStack {
            MessageListView(messages: messages)
            MessageInputView(messageText: $messageText, sendMessage: sendMessage)
        }
        .navigationTitle(conversationManager.currentConversation?.title ?? "New Chat")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
    }
    
    private func sendMessage() {
        let text = messageText
        guard !text.isEmpty else { return }
        
        messageText = ""
        
        Task {
            do {
                let userMessage = ChatMessage(role: "user", content: text)
                try await conversationManager.addMessage(userMessage)
            } catch {
                // Error is already handled in ConversationManager - shows error message in chat
            }
        }
    }
}

// A subview for displaying the list of messages to reduce complexity.
struct MessageListView: View {
    let messages: [ChatMessage]
    
    var body: some View {
        ScrollView {
            ScrollViewReader { proxy in
                LazyVStack(spacing: 12) {
                    ForEach(messages) { message in
                        MessageBubble(message: message)
                            .id(message.id)
                    }
                }
                .padding(.horizontal)
                .onChange(of: messages.count) { _ in
                    if let lastMessageId = messages.last?.id {
                        withAnimation {
                            proxy.scrollTo(lastMessageId, anchor: .bottom)
                        }
                    }
                }
            }
        }
    }
}

// A subview for the text input field and send button.
struct MessageInputView: View {
    @Binding var messageText: String
    let sendMessage: () -> Void
    
    var body: some View {
        HStack(spacing: 12) {
            TextField("Type a message...", text: $messageText)
                .textFieldStyle(RoundedBorderTextFieldStyle())
                .padding(.vertical, 8)
            
            Button(action: sendMessage) {
                Image(systemName: "paperplane.fill")
                    .font(.system(size: 20))
            }
            .disabled(messageText.isEmpty)
        }
        .padding()
    }
}

// Corrected MessageBubble to use the correct `ChatMessage` type.
struct MessageBubble: View {
    let message: ChatMessage
    
    var body: some View {
        HStack {
            if message.role == "user" {
                Spacer()
            }
            
            Text(message.content)
                .padding(12)
                .background(message.role == "user" ? Color.blue : Color.gray.opacity(0.2))
                .foregroundColor(message.role == "user" ? .white : .primary)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            
            if message.role != "user" {
                Spacer()
            }
        }
    }
}
