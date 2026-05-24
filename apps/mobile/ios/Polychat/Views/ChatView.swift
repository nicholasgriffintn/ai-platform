import SwiftUI

struct ChatView: View {
    @EnvironmentObject var conversationManager: ConversationManager
    @EnvironmentObject var modelsStore: ModelsStore
    @EnvironmentObject var apiClient: APIClient
    @State private var messageText = ""
    @State private var selectedAttachments: [ComposerAttachment] = []
    @State private var isUploadingAttachments = false
    @State private var isTranscribingVoice = false
    @State private var uploadError: String?
    @State private var voiceError: String?
    @State private var showingModelSelector = false
    @State private var showingChatSettings = false
    @State private var showingArtifacts = false
    @State private var chatSettings = ChatSettings.default
    @StateObject private var voiceRecorder = VoiceRecorder()

    private var messages: [ChatMessage] {
        conversationManager.currentConversation?.messages ?? []
    }

    private var activeModelId: String? {
        conversationManager.currentConversation?.modelId ??
        conversationManager.selectedModelId ??
        modelsStore.selectedModelId
    }

    private var activeModelName: String {
        guard let activeModelId else {
            return "Select model"
        }

        return modelsStore.model(withId: activeModelId)?.name ?? activeModelId
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
        VStack(spacing: 0) {
            MessageListView(messages: messages)
            MessageInputView(
                messageText: $messageText,
                selectedAttachments: $selectedAttachments,
                isUploadingAttachments: isUploadingAttachments,
                isRecordingVoice: voiceRecorder.isRecording,
                isTranscribingVoice: isTranscribingVoice,
                uploadError: uploadError,
                voiceError: voiceError,
                activeModelName: activeModelName,
                onFilesPicked: uploadFiles,
                onVoiceTapped: toggleVoiceRecording,
                onModelTapped: {
                    showingModelSelector = true
                },
                onSettingsTapped: {
                    showingChatSettings = true
                },
                sendMessage: sendMessage
            )
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(conversationManager.currentConversation?.title ?? "New Chat")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .toolbar {
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
                        _ = conversationManager.startNewConversation()
                    }) {
                        Image(systemName: "plus")
                    }
                }
            }
        }
        .sheet(isPresented: $showingModelSelector) {
            ModelSelectorView { modelId in
                conversationManager.setModelForCurrentConversation(modelId)
            }
        }
        .sheet(isPresented: $showingChatSettings) {
            ChatSettingsView(settings: $chatSettings)
        }
        .sheet(isPresented: $showingArtifacts) {
            ArtifactsView(artifacts: allArtifacts)
        }
    }
    
    private func sendMessage() {
        let text = messageText
        let attachments = selectedAttachments
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !attachments.isEmpty else { return }
        guard !isUploadingAttachments else { return }

        messageText = ""
        selectedAttachments = []

        Task {
            do {
                let userMessage: ChatMessage

                if attachments.isEmpty {
                    userMessage = ChatMessage(role: "user", content: text.trimmingCharacters(in: .whitespacesAndNewlines))
                } else {
                    var contentBlocks: [MessageContentBlock] = []

                    let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !trimmedText.isEmpty {
                        contentBlocks.append(.text(MessageContentBlock.TextBlock(text: trimmedText)))
                    }

                    for attachment in attachments {
                        if attachment.type != .markdownDocument || attachment.markdown?.isEmpty == false {
                            contentBlocks.append(attachment.contentBlock())
                        }
                    }

                    userMessage = ChatMessage(role: "user", contentBlocks: contentBlocks)
                }

                try await conversationManager.addMessage(userMessage, settings: chatSettings)
            } catch {
                // Error is already handled in ConversationManager - shows error message in chat
            }
        }
    }

    private func uploadFiles(_ files: [PickedComposerFile]) {
        guard !files.isEmpty else { return }

        isUploadingAttachments = true
        uploadError = nil

        Task {
            var uploadedAttachments: [ComposerAttachment] = []

            do {
                for file in files {
                    let response = try await apiClient.uploadFile(
                        data: file.data,
                        fileName: file.fileName,
                        mimeType: file.mimeType,
                        fileType: file.fileType,
                        convertToMarkdown: file.convertToMarkdown
                    )
                    uploadedAttachments.append(
                        ComposerAttachment(
                            type: attachmentType(from: response, fallbackFileType: file.fileType),
                            url: response.url,
                            name: response.name,
                            markdown: response.markdown,
                            thumbnail: file.thumbnail
                        )
                    )
                }

                await MainActor.run {
                    selectedAttachments.append(contentsOf: uploadedAttachments)
                    isUploadingAttachments = false
                }
            } catch {
                await MainActor.run {
                    uploadError = error.localizedDescription
                    isUploadingAttachments = false
                }
            }
        }
    }

    private func toggleVoiceRecording() {
        if voiceRecorder.isRecording {
            guard let recordingURL = voiceRecorder.stop() else { return }
            transcribeRecording(at: recordingURL)
            return
        }

        voiceError = nil
        Task {
            do {
                try await voiceRecorder.start()
            } catch {
                await MainActor.run {
                    voiceError = error.localizedDescription
                }
            }
        }
    }

    private func transcribeRecording(at url: URL) {
        isTranscribingVoice = true
        voiceError = nil

        Task {
            do {
                let data = try Data(contentsOf: url)
                let response = try await apiClient.transcribeAudio(
                    data: data,
                    fileName: url.lastPathComponent,
                    mimeType: "audio/mp4"
                )
                await MainActor.run {
                    let separator = messageText.isEmpty ? "" : "\n"
                    messageText += "\(separator)\(response.response.content)"
                    isTranscribingVoice = false
                }
            } catch {
                await MainActor.run {
                    voiceError = error.localizedDescription
                    isTranscribingVoice = false
                }
            }
        }
    }

    private func attachmentType(from response: UploadResponse, fallbackFileType: String) -> ComposerAttachmentType {
        if response.type == "markdown_document" {
            return .markdownDocument
        }

        switch fallbackFileType {
        case "image":
            return .image
        case "audio":
            return .audio
        default:
            return .document
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
                .onChange(of: messages.count) {
                    if let lastMessageId = messages.last?.id {
                        withAnimation {
                            proxy.scrollTo(lastMessageId, anchor: .bottom)
                        }
                    }
                }
            }
        }
        .background(Color(.systemGroupedBackground))
    }
}

// A subview for the text input field and send button.
struct MessageInputView: View {
    @Binding var messageText: String
    @Binding var selectedAttachments: [ComposerAttachment]
    let isUploadingAttachments: Bool
    let isRecordingVoice: Bool
    let isTranscribingVoice: Bool
    let uploadError: String?
    let voiceError: String?
    let activeModelName: String
    let onFilesPicked: ([PickedComposerFile]) -> Void
    let onVoiceTapped: () -> Void
    let onModelTapped: () -> Void
    let onSettingsTapped: () -> Void
    let sendMessage: () -> Void
    @FocusState private var isInputFocused: Bool

    private var canSend: Bool {
        (!messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !selectedAttachments.isEmpty) && !isUploadingAttachments
    }

    var body: some View {
        VStack(spacing: 0) {
            if !selectedAttachments.isEmpty || isUploadingAttachments {
                SelectedAttachmentsView(
                    attachments: selectedAttachments,
                    isUploading: isUploadingAttachments
                ) { attachmentId in
                    selectedAttachments.removeAll { $0.id == attachmentId }
                }
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            if let inputError = uploadError ?? voiceError {
                Text(inputError)
                    .font(.caption)
                    .foregroundStyle(Color.polychat.error)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
            }

            VStack(spacing: 0) {
                ZStack(alignment: .topLeading) {
                    if messageText.isEmpty {
                        Text("Message...")
                            .foregroundColor(Color(.systemGray3))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 14)
                    }

                    TextEditor(text: $messageText)
                        .focused($isInputFocused)
                        .scrollContentBackground(.hidden)
                        .frame(minHeight: 86, maxHeight: 150)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                }

                Divider()

                HStack(spacing: 10) {
                    AttachmentPickerView(disabled: isUploadingAttachments, onFilesPicked: onFilesPicked)
                        .foregroundColor(Color.polychat.primary)

                    Button(action: onModelTapped) {
                        HStack(spacing: 6) {
                            Text(activeModelName)
                                .font(.subheadline.weight(.medium))
                                .lineLimit(1)
                                .truncationMode(.tail)
                                .frame(maxWidth: 150, alignment: .leading)
                            Image(systemName: "chevron.down")
                                .font(.caption.weight(.semibold))
                        }
                        .foregroundColor(.primary)
                        .padding(.horizontal, 10)
                        .frame(height: 34)
                        .background(Color(.secondarySystemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Select model")

                    Button(action: onSettingsTapped) {
                        Image(systemName: "slider.horizontal.3")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundColor(.secondary)
                            .frame(width: 34, height: 34)
                    }
                    .accessibilityLabel("Chat settings")

                    Spacer(minLength: 4)

                    Button(action: onVoiceTapped) {
                        Image(systemName: voiceButtonIcon)
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundColor(isRecordingVoice ? .white : Color.polychat.primary)
                            .frame(width: 34, height: 34)
                            .background(isRecordingVoice ? Color.red : Color.polychat.primary.opacity(0.12))
                            .clipShape(Circle())
                    }
                    .disabled(isTranscribingVoice)

                    Button(action: sendMessage) {
                        Image(systemName: "arrow.up")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(width: 34, height: 34)
                            .background(canSend ? Color.polychat.primary : Color(.systemGray3))
                            .clipShape(Circle())
                    }
                    .disabled(!canSend)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
            }
            .background(Color(.systemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(isInputFocused ? Color.polychat.primary.opacity(0.45) : Color(.systemGray4), lineWidth: 1)
            )
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .background(.regularMaterial)
        .overlay(
            Rectangle()
                .frame(height: 0.5)
                .foregroundColor(Color(.systemGray4)),
            alignment: .top
        )
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: -2)
    }

    private var voiceButtonIcon: String {
        if isRecordingVoice {
            return "stop.fill"
        }
        if isTranscribingVoice {
            return "waveform"
        }
        return "mic"
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
                    if message.textContent == "..." {
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
                    } else if message.textContent.hasPrefix("Error:") {
                        // Error message
                        HStack(spacing: 8) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.orange)
                            Text(message.textContent)
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
                        MarkdownText(content: displayContent, isUser: message.role == "user")
                            .padding(.horizontal, 16)
                            .padding(.vertical, 12)
                            .background(messageBackground)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                }

                // Message actions
                if !message.textContent.contains("...") && !message.textContent.hasPrefix("Error:") {
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
            return Color.polychat.primary
        case "assistant":
            return Color(.systemGray5)
        default:
            return Color.gray.opacity(0.2)
        }
    }

    private var displayContent: String {
        let text = message.textContent
        if !text.isEmpty {
            return text
        }

        return attachmentPreviewText
    }

    private var attachmentPreviewText: String {
        guard case .multimodal(let blocks) = message.content else {
            return "Attachment"
        }

        let names = blocks.compactMap { block -> String? in
            switch block {
            case .imageUrl:
                return "Image"
            case .documentUrl(let document):
                return document.documentUrl.name ?? "Document"
            case .inputAudio:
                return "Audio"
            case .markdownDocument(let markdown):
                return markdown.markdownDocument.name ?? "Document"
            case .text:
                return nil
            }
        }

        return names.isEmpty ? "Attachment" : names.joined(separator: ", ")
    }

    private func regenerateMessage() {
        // TODO: Implement regenerate functionality
        // This would require modifying ConversationManager to support regeneration
    }

    private func copyMessage() {
        UIPasteboard.general.string = message.textContent
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
