import SwiftUI

struct ChatView: View {
    @EnvironmentObject var conversationManager: ConversationManager
    @EnvironmentObject var modelsStore: ModelsStore
    @State private var messageText = ""
    @State private var showingModelSelector = false
    @FocusState private var isInputFocused: Bool
    
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
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button(action: {
                    showingModelSelector = true
                }) {
                    HStack {
                        Image(systemName: "brain.head.profile")
                        if let selectedModel = modelsStore.getSelectedModel() {
                            Text(selectedModel.name ?? selectedModel.id)
                                .font(.caption)
                                .lineLimit(1)
                        }
                    }
                }
            }
            
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: {
                    conversationManager.startNewConversation()
                }) {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showingModelSelector) {
            ModelSelectorView()
        }
        .onTapGesture {
            isInputFocused = false
        }
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
    @FocusState private var isInputFocused: Bool
    
    var body: some View {
        HStack(spacing: 12) {
            TextEditor(text: $messageText)
                .focused($isInputFocused)
                .frame(minHeight: 36, maxHeight: 120)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 18))
                .overlay(
                    RoundedRectangle(cornerRadius: 18)
                        .stroke(Color(.systemGray4), lineWidth: 1)
                )
                .onSubmit {
                    sendMessage()
                }
            
            Button(action: sendMessage) {
                Image(systemName: "paperplane.fill")
                    .font(.system(size: 20))
                    .foregroundColor(.white)
                    .frame(width: 36, height: 36)
                    .background(messageText.isEmpty ? Color.gray : Color.blue)
                    .clipShape(Circle())
            }
            .disabled(messageText.isEmpty)
        }
        .padding()
        .background(Color(.systemBackground))
        .overlay(
            Rectangle()
                .frame(height: 1)
                .foregroundColor(Color(.systemGray5)),
            alignment: .top
        )
    }
}

// Corrected MessageBubble to use the correct `ChatMessage` type.
struct MessageBubble: View {
    let message: ChatMessage
    
    var body: some View {
        HStack {
            if message.role == "user" {
                Spacer(minLength: 60)
            }
            
            VStack(alignment: message.role == "user" ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .font(.body)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(messageBackground)
                    .foregroundColor(messageTextColor)
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                
                if message.content == "..." {
                    HStack {
                        ProgressView()
                            .scaleEffect(0.8)
                        Text("AI is thinking...")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
            
            if message.role != "user" {
                Spacer(minLength: 60)
            }
        }
        .padding(.horizontal, 4)
    }
    
    private var messageBackground: Color {
        switch message.role {
        case "user":
            return Color.blue
        case "assistant":
            return Color(.systemGray5)
        default:
            return Color.gray.opacity(0.2)
        }
    }
    
    private var messageTextColor: Color {
        switch message.role {
        case "user":
            return .white
        default:
            return .primary
        }
    }
}
