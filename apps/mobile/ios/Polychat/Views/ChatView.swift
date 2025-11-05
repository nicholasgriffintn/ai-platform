import SwiftUI

struct ChatView: View {
    @EnvironmentObject var conversationManager: ConversationManager
    @EnvironmentObject var modelsStore: ModelsStore
    @State private var messageText = ""
    @State private var showingModelSelector = false
    @State private var showingChatSettings = false
    @State private var showingArtifacts = false
    @State private var chatSettings = ChatSettings.default
    @FocusState private var isInputFocused: Bool

    private var messages: [ChatMessage] {
        conversationManager.currentConversation?.messages ?? []
    }

    private var allArtifacts: [Artifact] {
        messages.compactMap { message -> [Artifact]? in
            var mutableMessage = message
            if message.artifacts == nil {
                mutableMessage.extractArtifacts()
            }
            return mutableMessage.artifacts
        }.flatMap { $0 }
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
                Menu {
                    Button(action: {
                        showingModelSelector = true
                    }) {
                        Label("Change Model", systemImage: "brain.head.profile")
                    }

                    Button(action: {
                        showingChatSettings = true
                    }) {
                        Label("Chat Settings", systemImage: "slider.horizontal.3")
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "brain.head.profile")
                        if let selectedModel = modelsStore.getSelectedModel() {
                            Text(selectedModel.name ?? selectedModel.id)
                                .font(.caption)
                                .lineLimit(1)
                        }
                        Image(systemName: "chevron.down")
                            .font(.caption2)
                    }
                }
            }

            ToolbarItem(placement: .navigationBarTrailing) {
                HStack(spacing: 12) {
                    Button(action: {
                        showingArtifacts = true
                    }) {
                        ZStack(alignment: .topTrailing) {
                            Image(systemName: "doc.text")
                            if !allArtifacts.isEmpty {
                                Circle()
                                    .fill(Color.blue)
                                    .frame(width: 8, height: 8)
                                    .offset(x: 4, y: -4)
                            }
                        }
                    }
                    .disabled(allArtifacts.isEmpty)

                    Button(action: {
                        conversationManager.startNewConversation()
                    }) {
                        Image(systemName: "plus")
                    }
                }
            }
        }
        .sheet(isPresented: $showingModelSelector) {
            ModelSelectorView()
        }
        .sheet(isPresented: $showingChatSettings) {
            ChatSettingsView(settings: $chatSettings)
        }
        .sheet(isPresented: $showingArtifacts) {
            ArtifactsView(artifacts: allArtifacts)
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
    @State private var selectedImages: [UIImage] = []

    var body: some View {
        VStack(spacing: 0) {
            if !selectedImages.isEmpty {
                SelectedImagesView(images: $selectedImages)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            HStack(spacing: 12) {
                ImagePickerView(selectedImages: $selectedImages)
                    .foregroundColor(.blue)

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

                Button(action: {
                    sendMessage()
                    selectedImages = []
                }) {
                    Image(systemName: "paperplane.fill")
                        .font(.system(size: 20))
                        .foregroundColor(.white)
                        .frame(width: 36, height: 36)
                        .background((messageText.isEmpty && selectedImages.isEmpty) ? Color.gray : Color.blue)
                        .clipShape(Circle())
                }
                .disabled(messageText.isEmpty && selectedImages.isEmpty)
            }
            .padding()
        }
        .background(Color(.systemBackground))
        .overlay(
            Rectangle()
                .frame(height: 1)
                .foregroundColor(Color(.systemGray5)),
            alignment: .top
        )
    }
}

// Enhanced MessageBubble with markdown support and message actions
struct MessageBubble: View {
    let message: ChatMessage
    @State private var showActions = false
    @EnvironmentObject var conversationManager: ConversationManager

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            if message.role == "user" {
                Spacer(minLength: 60)
            }

            VStack(alignment: message.role == "user" ? .trailing : .leading, spacing: 8) {
                // Message content
                VStack(alignment: message.role == "user" ? .trailing : .leading, spacing: 0) {
                    if message.content == "..." {
                        // Loading indicator
                        HStack(spacing: 8) {
                            ProgressView()
                                .scaleEffect(0.8)
                            Text("AI is thinking...")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(Color(.systemGray5))
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    } else if message.content.hasPrefix("Error:") {
                        // Error message
                        HStack(spacing: 8) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.orange)
                            Text(message.content)
                                .font(.body)
                                .foregroundColor(.primary)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(Color.orange.opacity(0.1))
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(Color.orange.opacity(0.3), lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    } else {
                        // Regular message with markdown support
                        MarkdownText(content: message.content, isUser: message.role == "user")
                            .padding(.horizontal, 16)
                            .padding(.vertical, 12)
                            .background(messageBackground)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                }

                // Message actions
                if !message.content.contains("...") && !message.content.hasPrefix("Error:") {
                    HStack(spacing: 12) {
                        if message.role == "assistant" {
                            Button(action: regenerateMessage) {
                                HStack(spacing: 4) {
                                    Image(systemName: "arrow.clockwise")
                                    Text("Regenerate")
                                }
                                .font(.caption)
                                .foregroundColor(.blue)
                            }
                        }

                        Button(action: copyMessage) {
                            HStack(spacing: 4) {
                                Image(systemName: "doc.on.doc")
                                Text("Copy")
                            }
                            .font(.caption)
                            .foregroundColor(.secondary)
                        }
                    }
                    .opacity(showActions ? 1 : 0)
                }
            }
            .onTapGesture {
                withAnimation(.easeInOut(duration: 0.2)) {
                    showActions.toggle()
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

    private func regenerateMessage() {
        // TODO: Implement regenerate functionality
        // This would require modifying ConversationManager to support regeneration
    }

    private func copyMessage() {
        UIPasteboard.general.string = message.content
    }
}

// Markdown rendering view
struct MarkdownText: View {
    let content: String
    let isUser: Bool

    var body: some View {
        if let attributedString = try? AttributedString(markdown: content, options: AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)) {
            Text(attributedString)
                .font(.body)
                .foregroundColor(isUser ? .white : .primary)
                .textSelection(.enabled)
        } else {
            // Fallback if markdown parsing fails
            Text(content)
                .font(.body)
                .foregroundColor(isUser ? .white : .primary)
                .textSelection(.enabled)
        }
    }
}
