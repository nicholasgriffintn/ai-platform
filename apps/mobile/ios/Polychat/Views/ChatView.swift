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

    private var activeModelProvider: String? {
        guard let activeModelId else {
            return nil
        }

        return modelsStore.model(withId: activeModelId)?.provider
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
            MessageListView(
                messages: messages,
                conversationModelId: activeModelId,
                onSuggestionSelected: { suggestion in
                    messageText = suggestion
                }
            )
            MessageInputView(
                messageText: $messageText,
                selectedAttachments: $selectedAttachments,
                isUploadingAttachments: isUploadingAttachments,
                isRecordingVoice: voiceRecorder.isRecording,
                isTranscribingVoice: isTranscribingVoice,
                uploadError: uploadError,
                voiceError: voiceError,
                activeModelName: activeModelName,
                activeModelProvider: activeModelProvider,
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
        .background(Color.polychat.background)
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

struct MessageListView: View {
    let messages: [ChatMessage]
    let conversationModelId: String?
    let onSuggestionSelected: (String) -> Void
    
    var body: some View {
        ScrollView {
            ScrollViewReader { proxy in
                LazyVStack(spacing: 22) {
                    if messages.isEmpty {
                        WelcomePromptView(onSuggestionSelected: onSuggestionSelected)
                            .padding(.top, 150)
                    } else {
                        ForEach(messages) { message in
                            MessageBubble(message: message, conversationModelId: conversationModelId)
                                .id(message.id)
                        }
                    }
                }
                .frame(maxWidth: 860)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 28)
                .padding(.top, messages.isEmpty ? 28 : 72)
                .padding(.bottom, 28)
                .onChange(of: messages.count) {
                    if let lastMessageId = messages.last?.id {
                        withAnimation {
                            proxy.scrollTo(lastMessageId, anchor: .bottom)
                        }
                    }
                }
                .onChange(of: messages.last?.textContent) {
                    if let lastMessageId = messages.last?.id {
                        withAnimation(.easeOut(duration: 0.18)) {
                            proxy.scrollTo(lastMessageId, anchor: .bottom)
                        }
                    }
                }
            }
        }
        .background(Color.polychat.background)
    }
}

private struct WelcomePromptView: View {
    private let suggestions = [
        ("brain.head.profile", "Data Analysis", "Analyze this CSV and summarize the strongest trends."),
        ("shield", "Existential inquiry", "What makes an answer useful when the question is ambiguous?"),
        ("face.smiling", "Satirical news", "Write a short satirical news brief about robots asking for coffee breaks."),
        ("chevron.left.forwardslash.chevron.right", "Code Optimization", "Review this SwiftUI view and suggest performance improvements.")
    ]
    let onSuggestionSelected: (String) -> Void

    var body: some View {
        VStack(spacing: 18) {
            PolychatLogoView(size: 72)
            VStack(spacing: 8) {
                Text("What would you like to know?")
                    .font(.system(size: 34, weight: .bold))
                    .multilineTextAlignment(.center)
                Text("I'm a helpful assistant that can answer questions about basically anything.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            VStack(alignment: .leading, spacing: 10) {
                Text("Try asking about...")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    ForEach(suggestions, id: \.1) { icon, title, prompt in
                        Button {
                            onSuggestionSelected(prompt)
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: icon)
                                    .frame(width: 18)
                                Text(title)
                                    .lineLimit(1)
                                Spacer()
                            }
                            .font(.subheadline.weight(.medium))
                            .padding(.horizontal, 14)
                            .frame(height: 48)
                            .background(Color.polychat.elevatedBackground)
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .stroke(Color.polychat.border, lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .frame(maxWidth: 620)
            .padding(.top, 20)
        }
    }
}

struct MessageInputView: View {
    @Binding var messageText: String
    @Binding var selectedAttachments: [ComposerAttachment]
    let isUploadingAttachments: Bool
    let isRecordingVoice: Bool
    let isTranscribingVoice: Bool
    let uploadError: String?
    let voiceError: String?
    let activeModelName: String
    let activeModelProvider: String?
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
                TextField("Ask me anything...", text: $messageText, axis: .vertical)
                    .focused($isInputFocused)
                    .textFieldStyle(.plain)
                    .font(.body)
                    .lineLimit(1...4)
                    .frame(minHeight: 30, alignment: .topLeading)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 10)
                    .onSubmit {
                        if canSend {
                            sendMessage()
                        }
                    }

                Rectangle()
                    .fill(Color.polychat.border)
                    .frame(height: 1)

                HStack(spacing: 10) {
                    AttachmentPickerView(disabled: isUploadingAttachments, onFilesPicked: onFilesPicked)
                        .foregroundColor(.secondary)

                    Button(action: onModelTapped) {
                        HStack(spacing: 6) {
                            ModelIconView(
                                modelName: activeModelName,
                                provider: activeModelProvider,
                                size: 18
                            )

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
                        .background(Color.polychat.elevatedBackground)
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
                            .foregroundColor(isRecordingVoice ? .white : .secondary)
                            .frame(width: 34, height: 34)
                            .background(isRecordingVoice ? Color.red : Color.clear)
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }
                    .disabled(isTranscribingVoice)

                    Button(action: sendMessage) {
                        Image(systemName: "paperplane.fill")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundColor(Color(light: .white, dark: .black))
                            .frame(width: 38, height: 38)
                            .background(canSend ? Color(light: .black, dark: Color.polychat.offWhite) : Color.polychat.zinc500.opacity(0.55))
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }
                    .disabled(!canSend)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
            }
            .background(Color.polychat.composerBackground)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(isInputFocused ? Color.polychat.zinc500 : Color.polychat.border, lineWidth: 1)
            )
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .frame(maxWidth: 900)
        }
        .frame(maxWidth: .infinity)
        .background(Color.polychat.background)
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

struct MessageBubble: View {
    let message: ChatMessage
    let conversationModelId: String?
    @EnvironmentObject var conversationManager: ConversationManager
    @EnvironmentObject var modelsStore: ModelsStore

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if message.role == "user" {
                Spacer(minLength: 80)
            }

            if message.role == "assistant" {
                ModelIconView(
                    modelName: assistantModel?.name ?? assistantModelId ?? "Assistant",
                    provider: assistantModel?.provider,
                    size: 28
                )
                .padding(.top, 2)
            }

            VStack(alignment: message.role == "user" ? .trailing : .leading, spacing: 8) {
                if message.renderedTextContent.isEmpty && message.role == "assistant" {
                    HStack(spacing: 8) {
                        ProgressView()
                            .scaleEffect(0.8)
                        Text("Generating response...")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 10)
                } else if message.textContent.hasPrefix("Error:") {
                    HStack(spacing: 8) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.orange)
                        Text(message.textContent)
                            .font(.body)
                            .foregroundColor(.primary)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .background(Color.orange.opacity(0.1))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(Color.orange.opacity(0.3), lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                } else {
                    MessageContentView(message: message)
                        .padding(.horizontal, message.role == "user" ? 14 : 0)
                        .padding(.vertical, message.role == "user" ? 10 : 0)
                        .background(messageBackground)
                }

                if !message.renderedTextContent.isEmpty && !message.renderedTextContent.hasPrefix("Error:") {
                    HStack(spacing: 12) {
                        if message.role == "assistant" {
                            Button(action: regenerateMessage) {
                                Image(systemName: "arrow.clockwise")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }

                        Button(action: copyMessage) {
                            Image(systemName: "doc.on.doc")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }

            if message.role != "user" {
                Spacer(minLength: 0)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var messageBackground: Color {
        switch message.role {
        case "user":
            return Color.polychat.messageUserBackground.opacity(0.65)
        case "assistant":
            return Color.clear
        default:
            return Color.gray.opacity(0.2)
        }
    }

    private var assistantModelId: String? {
        message.model ?? conversationModelId
    }

    private var assistantModel: ModelConfigItem? {
        guard let assistantModelId else {
            return nil
        }

        return modelsStore.model(withId: assistantModelId)
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
            case .audioUrl:
                return "Audio"
            case .documentUrl(let document):
                return document.documentUrl.name ?? "Document"
            case .inputAudio:
                return "Audio"
            case .markdownDocument(let markdown):
                return markdown.markdownDocument.name ?? "Document"
            case .artifact(let artifact):
                return artifact.artifact.title ?? "Artifact"
            case .text, .thinking:
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
        UIPasteboard.general.string = message.renderedTextContent
    }
}

private struct MessageContentView: View {
    let message: ChatMessage

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let asyncInvocation = message.data?.asyncInvocation,
               message.status == "in_progress" {
                AsyncInvocationStatusView(asyncInvocation: asyncInvocation, fallback: "Content generation in progress...")
            }

            if message.status == "failed" {
                Text(message.data?.asyncInvocation?.contentHints?.failure?.textContent ?? message.data?.error ?? "Generation failed. Please try again.")
                    .font(.subheadline)
                    .foregroundStyle(Color.polychat.error)
            }

            if let parts = message.parts, !parts.isEmpty {
                MessagePartsView(message: message, parts: parts)
            } else {
                MessageContentBlocksView(message: message)
            }
        }
    }
}

private struct MessagePartsView: View {
    let message: ChatMessage
    let parts: [ChatMessagePart]

    private var hasReasoningPart: Bool {
        parts.contains { $0.type == "reasoning" }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let citations = message.citations, !citations.isEmpty {
                CitationListView(citations: citations)
            }

            if let searchGrounding = message.data?.searchGrounding {
                SearchGroundingView(searchGrounding: searchGrounding)
            }

            if let reasoning = message.reasoning, !hasReasoningPart {
                ReasoningSectionView(reasoning: reasoning)
            }

            ForEach(Array(parts.enumerated()), id: \.offset) { index, part in
                switch part.type {
                case "text":
                    if let text = part.text {
                        TextContentSection(role: message.role, text: text, reasoning: nil, citations: nil, data: nil)
                    }
                case "reasoning":
                    if let text = part.text {
                        ReasoningSectionView(reasoning: ChatReasoning(collapsed: part.collapsed ?? true, content: text))
                    }
                case "tool_use":
                    ToolUsePartView(part: part)
                case "tool_result":
                    ToolResultPartView(part: part)
                case "snapshot":
                    if let summary = part.summary {
                        SnapshotPartView(title: part.title, summary: summary)
                    }
                case "file":
                    FilePartView(name: part.name, url: part.url, mimeType: part.mimeType)
                default:
                    EmptyView()
                }
            }
        }
    }
}

private struct MessageContentBlocksView: View {
    let message: ChatMessage

    private var thinkingContent: String {
        guard case .multimodal(let blocks) = message.content else {
            return ""
        }

        return blocks.compactMap { block -> String? in
            if case .thinking(let thinking) = block {
                return thinking.thinking
            }
            return nil
        }.joined(separator: "\n")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            switch message.content {
            case .text(let text):
                TextContentSection(
                    role: message.role,
                    text: text,
                    reasoning: message.reasoning ?? (thinkingContent.isEmpty ? nil : ChatReasoning(collapsed: true, content: thinkingContent)),
                    citations: message.citations,
                    data: message.data
                )
            case .multimodal(let blocks):
                ForEach(Array(blocks.enumerated()), id: \.offset) { index, block in
                    switch block {
                    case .text(let text) where !text.text.isEmpty:
                        TextContentSection(
                            role: message.role,
                            text: text.text,
                            reasoning: message.reasoning ?? (thinkingContent.isEmpty ? nil : ChatReasoning(collapsed: true, content: thinkingContent)),
                            citations: message.citations,
                            data: message.data
                        )
                    case .imageUrl(let image):
                        RemoteImageView(urlString: image.imageUrl.url)
                    case .audioUrl(let audio):
                        AudioAttachmentView(urlString: audio.audioUrl.url, name: nil)
                    case .inputAudio(let audio):
                        AudioAttachmentView(urlString: audio.inputAudio.data, name: nil)
                    case .documentUrl(let document):
                        DocumentAttachmentView(urlString: document.documentUrl.url, name: document.documentUrl.name, isMarkdown: false)
                    case .markdownDocument(let document):
                        DocumentAttachmentView(urlString: "", name: document.markdownDocument.name, isMarkdown: true)
                        MarkdownText(content: document.markdownDocument.markdown, isUser: message.role == "user")
                    case .artifact(let artifact):
                        InlineArtifactCalloutView(artifact: Artifact(webArtifact: artifact.artifact))
                    case .thinking:
                        EmptyView()
                    default:
                        EmptyView()
                    }
                }

                if message.textContent.isEmpty, let data = message.data, data.attachments?.isEmpty == false {
                    MessageDataAttachmentsView(data: data)
                }
            }
        }
    }
}

private struct TextContentSection: View {
    let role: String
    let text: String
    let reasoning: ChatReasoning?
    let citations: [ChatCitation]?
    let data: ChatMessageData?

    private var formatted: FormattedMessageContent {
        MessageFormatting.formattedMessageContent(role: role, originalContent: text)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let reasoning, !reasoning.content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                ReasoningSectionView(reasoning: reasoning)
            } else if !formatted.reasoning.isEmpty {
                ReasoningSectionView(
                    reasoning: ChatReasoning(
                        collapsed: !formatted.reasoning.contains { $0.isOpen },
                        content: formatted.reasoning.map(\.content).joined(separator: "\n")
                    )
                )
            }

            if let citations, !citations.isEmpty {
                CitationListView(citations: citations)
            }

            if let searchGrounding = data?.searchGrounding {
                SearchGroundingView(searchGrounding: searchGrounding)
            }

            ArtifactSplitContentView(formatted: formatted, isUser: role == "user")

            if let data {
                MessageDataAttachmentsView(data: data)
            }
        }
    }
}

private struct ArtifactSplitContentView: View {
    let formatted: FormattedMessageContent
    let isUser: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(Array(formatted.segments.enumerated()), id: \.offset) { _, segment in
                switch segment {
                case .text(let text):
                    if !text.isEmpty {
                        MarkdownText(content: MessageFormatting.processCustomXmlTags(text), isUser: isUser)
                    }
                case .artifact(let artifact):
                    InlineArtifactCalloutView(artifact: artifact)
                }
            }
        }
    }
}

private struct ReasoningSectionView: View {
    let reasoning: ChatReasoning
    @State private var collapsed: Bool

    init(reasoning: ChatReasoning) {
        self.reasoning = reasoning
        self._collapsed = State(initialValue: reasoning.collapsed)
    }

    var body: some View {
        if !reasoning.content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                Button {
                    collapsed.toggle()
                } label: {
                    HStack(spacing: 4) {
                        Text("Reasoning")
                        Image(systemName: collapsed ? "chevron.right" : "chevron.down")
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)

                if !collapsed {
                    MarkdownText(content: reasoning.content, isUser: false)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

private struct CitationListView: View {
    let citations: [ChatCitation]
    var maxDisplayed = 3
    @State private var showAll = false

    private var displayedCitations: [ChatCitation] {
        showAll ? citations : Array(citations.prefix(maxDisplayed))
    }

    var body: some View {
        if !displayedCitations.isEmpty {
            HStack(spacing: 6) {
                Text("Sources:")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                ForEach(displayedCitations, id: \.url) { citation in
                    Link(destination: URL(string: citation.url) ?? URL(string: "https://polychat.app")!) {
                        Text(sourceLabel(for: citation))
                            .font(.caption.weight(.medium))
                            .lineLimit(1)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 5)
                            .background(Color.polychat.elevatedBackground)
                            .clipShape(Capsule())
                            .overlay(Capsule().stroke(Color.polychat.border, lineWidth: 1))
                    }
                }

                if citations.count > maxDisplayed {
                    Button(showAll ? "Show less" : "+\(citations.count - maxDisplayed) more") {
                        showAll.toggle()
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
            }
        }
    }

    private func sourceLabel(for citation: ChatCitation) -> String {
        if let title = citation.title, !title.isEmpty {
            return title
        }
        return URL(string: citation.url)?.host ?? citation.url
    }
}

private struct SearchGroundingView: View {
    let searchGrounding: ChatMessageData.SearchGrounding

    private var citations: [ChatCitation] {
        (searchGrounding.groundingChunks ?? []).compactMap { chunk in
            guard let web = chunk.web else { return nil }
            return ChatCitation(url: web.uri, title: web.title)
        }
    }

    var body: some View {
        if !citations.isEmpty || searchGrounding.webSearchQueries?.isEmpty == false {
            VStack(alignment: .leading, spacing: 8) {
                if let queries = searchGrounding.webSearchQueries, !queries.isEmpty {
                    HStack(alignment: .top, spacing: 6) {
                        Text("Queries:")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        FlexibleTagView(items: queries)
                    }
                }

                if !citations.isEmpty {
                    CitationListView(citations: citations, maxDisplayed: 5)
                }
            }
        }
    }
}

private struct FlexibleTagView: View {
    let items: [String]

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 92), spacing: 6)], alignment: .leading, spacing: 6) {
            ForEach(items, id: \.self) { item in
                Link(destination: URL(string: "https://www.google.com/search?q=\(item.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? item)")!) {
                    Text(item)
                        .font(.caption)
                        .lineLimit(1)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 5)
                        .background(Color.polychat.elevatedBackground)
                        .clipShape(Capsule())
                }
            }
        }
    }
}

private struct InlineArtifactCalloutView: View {
    let artifact: Artifact
    @State private var showingArtifact = false

    private var isCode: Bool {
        let language = artifact.language?.lowercased() ?? ""
        return ["jsx", "javascript", "html", "svg"].contains { language.contains($0) }
    }

    var body: some View {
        Button {
            showingArtifact = true
        } label: {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: isCode ? "chevron.left.forwardslash.chevron.right" : "doc.text")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding(.top, 2)

                VStack(alignment: .leading, spacing: 3) {
                    Text(artifact.title)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    Text("Click here to open the \(isCode ? "code" : "file")")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer(minLength: 8)

                if let language = artifact.language {
                    Text(language)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(10)
            .background(Color.clear)
            .overlay(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(Color.polychat.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .sheet(isPresented: $showingArtifact) {
            FullArtifactView(artifact: artifact)
        }
    }
}

private struct MessageDataAttachmentsView: View {
    let data: ChatMessageData

    var body: some View {
        if let attachments = data.attachments, !attachments.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(attachments) { attachment in
                    switch attachment.type {
                    case "image":
                        RemoteImageView(urlString: attachment.url)
                    case "audio":
                        AudioAttachmentView(urlString: attachment.url, name: attachment.name)
                    case "document":
                        DocumentAttachmentView(urlString: attachment.url, name: attachment.name, isMarkdown: attachment.isMarkdown == true)
                    default:
                        if !attachment.url.isEmpty {
                            Text("[[CONTENT:\(attachment.url)]]")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }
}

private struct RemoteImageView: View {
    let urlString: String

    var body: some View {
        if let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFit()
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                case .failure:
                    DocumentAttachmentView(urlString: urlString, name: "Image", isMarkdown: false)
                case .empty:
                    ProgressView()
                        .frame(height: 120)
                        .frame(maxWidth: .infinity)
                @unknown default:
                    EmptyView()
                }
            }
        }
    }
}

private struct DocumentAttachmentView: View {
    let urlString: String
    let name: String?
    let isMarkdown: Bool

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "doc")
                .foregroundStyle(Color.polychat.primary)

            VStack(alignment: .leading, spacing: 3) {
                Text(name ?? "Document")
                    .font(.subheadline)
                    .foregroundStyle(.primary)
                if isMarkdown {
                    Text("converted to text")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if let url = URL(string: urlString), !urlString.isEmpty {
                    Link("View document", destination: url)
                        .font(.caption)
                }
            }

            Spacer(minLength: 0)
        }
        .padding(12)
        .background(Color.polychat.elevatedBackground.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(Color.polychat.border, lineWidth: 1))
    }
}

private struct AudioAttachmentView: View {
    let urlString: String
    let name: String?

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "speaker.wave.2")
                .foregroundStyle(Color.purple)
            VStack(alignment: .leading, spacing: 3) {
                Text(name ?? "Audio")
                    .font(.subheadline)
                if let url = URL(string: urlString), !urlString.isEmpty {
                    Link("Open audio", destination: url)
                        .font(.caption)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(Color.polychat.elevatedBackground.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(Color.polychat.border, lineWidth: 1))
    }
}

private struct ToolUsePartView: View {
    let part: ChatMessagePart

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Tool call: \(part.name ?? "tool")")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.orange)
            ScrollView(.horizontal) {
                Text(part.input?.prettyString ?? "{}")
                    .font(.system(.caption, design: .monospaced))
                    .textSelection(.enabled)
            }
        }
        .padding(12)
        .background(Color.orange.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(Color.orange.opacity(0.25), lineWidth: 1))
    }
}

private struct ToolResultPartView: View {
    let part: ChatMessagePart

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Tool result\(part.name.map { ": \($0)" } ?? "")\(part.status.map { " (\($0))" } ?? "")")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.polychat.primary)

            if let content = part.content?.prettyString, !content.isEmpty {
                MarkdownText(content: content, isUser: false)
            } else {
                Text("No tool output")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .background(Color.polychat.primary.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(Color.polychat.primary.opacity(0.25), lineWidth: 1))
    }
}

private struct SnapshotPartView: View {
    let title: String?
    let summary: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let title {
                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            MarkdownText(content: summary, isUser: false)
        }
        .padding(12)
        .background(Color.polychat.elevatedBackground.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(Color.polychat.border, lineWidth: 1))
    }
}

private struct FilePartView: View {
    let name: String?
    let url: String?
    let mimeType: String?

    var body: some View {
        if let mimeType, mimeType.hasPrefix("image/"), let url {
            RemoteImageView(urlString: url)
        } else if let mimeType, mimeType.hasPrefix("audio/") {
            AudioAttachmentView(urlString: url ?? "", name: name)
        } else {
            DocumentAttachmentView(urlString: url ?? "", name: name, isMarkdown: mimeType == "text/markdown")
        }
    }
}

private struct AsyncInvocationStatusView: View {
    let asyncInvocation: ChatMessageData.AsyncInvocation
    let fallback: String

    var body: some View {
        HStack(spacing: 8) {
            ProgressView()
                .scaleEffect(0.8)
            Text(asyncInvocation.contentHints?.progress?.textContent ?? asyncInvocation.contentHints?.placeholder?.textContent ?? fallback)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }
}

// Markdown rendering view
struct MarkdownText: View {
    let content: String
    let isUser: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: isUser ? 6 : 14) {
            ForEach(MarkdownBlock.blocks(from: MarkdownFixer.fix(content))) { block in
                switch block.kind {
                case .markdown:
                    MarkdownProse(text: block.content, isUser: isUser)
                case .code(let language):
                    CodeBlockView(code: block.content, language: language)
                case .table(let table):
                    MarkdownTableView(table: table)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct MarkdownProse: View {
    let text: String
    let isUser: Bool

    var body: some View {
        Group {
            if let attributedString = try? AttributedString(markdown: text) {
                Text(attributedString)
            } else {
                Text(text)
            }
        }
        .font(.body)
        .lineSpacing(4)
        .foregroundColor(isUser ? .primary : .primary)
        .textSelection(.enabled)
    }
}

private struct CodeBlockView: View {
    let code: String
    let language: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let language, !language.isEmpty {
                Text(language.uppercased())
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 12)
                    .padding(.top, 10)
                    .padding(.bottom, 6)
            }

            ScrollView(.horizontal, showsIndicators: true) {
                Text(code)
                    .font(.system(.callout, design: .monospaced))
                    .foregroundStyle(Color(light: Color.polychat.zinc800, dark: Color.polychat.zinc100))
                    .textSelection(.enabled)
                    .padding(.horizontal, 12)
                    .padding(.vertical, language?.isEmpty == false ? 6 : 12)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .background(Color(light: Color.polychat.zinc100, dark: Color(red: 8/255, green: 12/255, blue: 18/255)))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(Color.polychat.border, lineWidth: 1)
        )
    }
}

private struct MarkdownTableView: View {
    let table: MarkdownTable

    var body: some View {
        ScrollView(.horizontal, showsIndicators: true) {
            Grid(alignment: .leading, horizontalSpacing: 0, verticalSpacing: 0) {
                GridRow {
                    ForEach(table.headers.indices, id: \.self) { index in
                        tableCell(table.headers[index], isHeader: true)
                    }
                }

                ForEach(table.rows.indices, id: \.self) { rowIndex in
                    GridRow {
                        ForEach(table.headers.indices, id: \.self) { columnIndex in
                            tableCell(table.rows[rowIndex].value(at: columnIndex), isHeader: false)
                        }
                    }
                }
            }
            .background(Color.polychat.elevatedBackground)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(Color.polychat.border, lineWidth: 1)
            )
        }
    }

    private func tableCell(_ text: String, isHeader: Bool) -> some View {
        Text(text)
            .font(isHeader ? .subheadline.weight(.semibold) : .subheadline)
            .foregroundStyle(isHeader ? .primary : .secondary)
            .textSelection(.enabled)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .frame(minWidth: 130, alignment: .leading)
            .background(isHeader ? Color.polychat.secondaryBackground : Color.clear)
            .overlay(alignment: .trailing) {
                Rectangle()
                    .fill(Color.polychat.border)
                    .frame(width: 1)
            }
            .overlay(alignment: .bottom) {
                Rectangle()
                    .fill(Color.polychat.border)
                    .frame(height: 1)
            }
    }
}

private struct MarkdownTable {
    let headers: [String]
    let rows: [[String]]
}

private extension Array where Element == String {
    func value(at index: Int) -> String {
        indices.contains(index) ? self[index] : ""
    }
}

private struct MarkdownBlock: Identifiable {
    enum Kind {
        case markdown
        case code(language: String?)
        case table(MarkdownTable)
    }

    let id = UUID()
    let kind: Kind
    let content: String

    static func blocks(from markdown: String) -> [MarkdownBlock] {
        var result: [MarkdownBlock] = []
        var currentMarkdown: [String] = []
        var currentCode: [String] = []
        var codeLanguage: String?
        var isInCodeBlock = false

        for line in markdown.components(separatedBy: .newlines) {
            if line.hasPrefix("```") {
                if isInCodeBlock {
                    result.append(MarkdownBlock(kind: .code(language: codeLanguage), content: currentCode.joined(separator: "\n")))
                    currentCode = []
                    codeLanguage = nil
                    isInCodeBlock = false
                } else {
                    if !currentMarkdown.isEmpty {
                        appendMarkdownBlocks(currentMarkdown, to: &result)
                        currentMarkdown = []
                    }
                    codeLanguage = String(line.dropFirst(3)).trimmingCharacters(in: .whitespacesAndNewlines)
                    isInCodeBlock = true
                }
                continue
            }

            if isInCodeBlock {
                currentCode.append(line)
            } else {
                currentMarkdown.append(line)
            }
        }

        if isInCodeBlock {
            result.append(MarkdownBlock(kind: .code(language: codeLanguage), content: currentCode.joined(separator: "\n")))
        } else if !currentMarkdown.isEmpty {
            appendMarkdownBlocks(currentMarkdown, to: &result)
        }

        return result.isEmpty ? [MarkdownBlock(kind: .markdown, content: markdown)] : result
    }

    private static func appendMarkdownBlocks(_ lines: [String], to result: inout [MarkdownBlock]) {
        var prose: [String] = []
        var index = 0

        func flushProse() {
            if !prose.isEmpty {
                result.append(MarkdownBlock(kind: .markdown, content: prose.joined(separator: "\n")))
                prose = []
            }
        }

        while index < lines.count {
            if let table = tableStarting(at: index, in: lines) {
                flushProse()
                result.append(MarkdownBlock(kind: .table(table.value), content: ""))
                index = table.nextIndex
            } else {
                prose.append(lines[index])
                index += 1
            }
        }

        flushProse()
    }

    private static func tableStarting(at index: Int, in lines: [String]) -> (value: MarkdownTable, nextIndex: Int)? {
        guard index + 1 < lines.count,
              isTableRow(lines[index]),
              isTableDivider(lines[index + 1]) else {
            return nil
        }

        let headers = cells(from: lines[index])
        guard !headers.isEmpty else {
            return nil
        }

        var rows: [[String]] = []
        var rowIndex = index + 2
        while rowIndex < lines.count, isTableRow(lines[rowIndex]) {
            rows.append(cells(from: lines[rowIndex]))
            rowIndex += 1
        }

        return (MarkdownTable(headers: headers, rows: rows), rowIndex)
    }

    private static func isTableRow(_ line: String) -> Bool {
        line.contains("|") && cells(from: line).count > 1
    }

    private static func isTableDivider(_ line: String) -> Bool {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        guard trimmed.contains("|") else {
            return false
        }

        let columns = cells(from: trimmed)
        return !columns.isEmpty && columns.allSatisfy { column in
            let cleaned = column.replacingOccurrences(of: ":", with: "").trimmingCharacters(in: .whitespaces)
            return cleaned.count >= 3 && cleaned.allSatisfy { $0 == "-" }
        }
    }

    private static func cells(from line: String) -> [String] {
        var trimmed = line.trimmingCharacters(in: .whitespaces)
        if trimmed.hasPrefix("|") {
            trimmed.removeFirst()
        }
        if trimmed.hasSuffix("|") {
            trimmed.removeLast()
        }

        return trimmed
            .split(separator: "|", omittingEmptySubsequences: false)
            .map { String($0).trimmingCharacters(in: .whitespaces) }
    }
}

private enum MessageContentSegment {
    case text(String)
    case artifact(Artifact)
}

private struct FormattedMessageContent {
    struct ReasoningItem {
        let content: String
        let isOpen: Bool
    }

    let segments: [MessageContentSegment]
    let reasoning: [ReasoningItem]
    let artifacts: [Artifact]
}

private enum MessageFormatting {
    static func formattedMessageContent(role: String, originalContent: String) -> FormattedMessageContent {
        var content = originalContent
        var reasoning: [FormattedMessageContent.ReasoningItem] = []
        var artifacts: [Artifact] = []

        extractReasoning(tag: "think", from: &content, into: &reasoning)
        extractReasoning(tag: "analysis", from: &content, into: &reasoning)

        if role == "assistant" {
            artifacts = extractArtifacts(from: content)
            for artifact in artifacts {
                let pattern = "<artifact[^>]*identifier=\"\(NSRegularExpression.escapedPattern(for: artifact.id))\"[^>]*>[\\s\\S]*?(?:</artifact>|$)"
                content = content.replacingOccurrences(
                    of: pattern,
                    with: "[[ARTIFACT:\(artifact.id)]]",
                    options: .regularExpression
                )
            }
        }

        content = unwrapTag("answer", in: content).trimmingCharacters(in: .whitespacesAndNewlines)
        let segments = splitContentByArtifacts(content: content, artifacts: artifacts)
        return FormattedMessageContent(segments: segments, reasoning: reasoning, artifacts: artifacts)
    }

    static func processCustomXmlTags(_ text: String) -> String {
        let fencePattern = "```[\\s\\S]*?```"
        guard let fenceRegex = try? NSRegularExpression(pattern: fencePattern) else {
            return text
        }

        let nsText = text as NSString
        let matches = fenceRegex.matches(in: text, range: NSRange(location: 0, length: nsText.length))
        var protected = text
        var fences: [String] = []

        for match in matches.reversed() {
            let fence = nsText.substring(with: match.range)
            fences.insert(fence, at: 0)
            protected = (protected as NSString).replacingCharacters(in: match.range, with: "<<CODE_BLOCK_\(fences.count - 1)>>")
        }

        let tagPattern = "<([A-Za-z][\\w-]*)\\b[^>]*>([\\s\\S]*?)</\\1>"
        guard let tagRegex = try? NSRegularExpression(pattern: tagPattern) else {
            return text
        }

        let nsProtected = protected as NSString
        var processed = protected
        let tagMatches = tagRegex.matches(in: protected, range: NSRange(location: 0, length: nsProtected.length))
        for match in tagMatches.reversed() where match.numberOfRanges >= 3 {
            let tagName = nsProtected.substring(with: match.range(at: 1))
            let inner = nsProtected.substring(with: match.range(at: 2))
            let title = tagName
                .split { $0 == "_" || $0 == "-" }
                .map { $0.prefix(1).uppercased() + $0.dropFirst().lowercased() }
                .joined(separator: " ")
            processed = (processed as NSString).replacingCharacters(in: match.range, with: "**\(title)**\n\n\(inner)\n\n")
        }

        for (index, fence) in fences.enumerated() {
            processed = processed.replacingOccurrences(of: "<<CODE_BLOCK_\(index)>>", with: fence)
        }

        return processed
    }

    private static func extractReasoning(
        tag: String,
        from content: inout String,
        into reasoning: inout [FormattedMessageContent.ReasoningItem]
    ) {
        let pattern = "<\(tag)>([\\s\\S]*?)(</\(tag)>|$)"
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return
        }

        let nsContent = content as NSString
        let matches = regex.matches(in: content, range: NSRange(location: 0, length: nsContent.length))
        for match in matches.reversed() where match.numberOfRanges >= 2 {
            let full = nsContent.substring(with: match.range)
            let value = nsContent.substring(with: match.range(at: 1)).trimmingCharacters(in: .whitespacesAndNewlines)
            reasoning.insert(FormattedMessageContent.ReasoningItem(content: value, isOpen: !full.contains("</\(tag)>")), at: 0)
            content = (content as NSString).replacingCharacters(in: match.range, with: "")
        }
    }

    private static func extractArtifacts(from content: String) -> [Artifact] {
        let pattern = "<artifact\\s+([^>]*)>([\\s\\S]*?)(</artifact>|$)"
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return []
        }

        let nsContent = content as NSString
        return regex.matches(in: content, range: NSRange(location: 0, length: nsContent.length)).compactMap { match in
            guard match.numberOfRanges >= 3 else { return nil }
            let attributes = nsContent.substring(with: match.range(at: 1))
            guard let identifier = attribute("identifier", in: attributes), !identifier.isEmpty else {
                return nil
            }

            let type = attribute("type", in: attributes) ?? "text"
            let language = attribute("language", in: attributes) ?? type
            let title = attribute("title", in: attributes) ?? "Artifact"
            let artifactContent = nsContent.substring(with: match.range(at: 2)).trimmingCharacters(in: .whitespacesAndNewlines)
            return Artifact(id: identifier, type: Artifact.ArtifactType(webType: type, language: language), title: title, content: artifactContent, language: language)
        }
    }

    private static func attribute(_ name: String, in attributes: String) -> String? {
        let pattern = "\(name)=\"([^\"]*)\""
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else {
            return nil
        }

        let nsAttributes = attributes as NSString
        guard let match = regex.firstMatch(in: attributes, range: NSRange(location: 0, length: nsAttributes.length)),
              match.numberOfRanges >= 2 else {
            return nil
        }
        return nsAttributes.substring(with: match.range(at: 1))
    }

    private static func unwrapTag(_ tag: String, in content: String) -> String {
        let pattern = "<\(tag)>([\\s\\S]*?)(</\(tag)>|$)"
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return content.replacingOccurrences(of: "<\(tag)>", with: "").replacingOccurrences(of: "</\(tag)>", with: "")
        }

        let nsContent = content as NSString
        var result = content
        let matches = regex.matches(in: content, range: NSRange(location: 0, length: nsContent.length))
        for match in matches.reversed() where match.numberOfRanges >= 2 {
            let inner = nsContent.substring(with: match.range(at: 1))
            result = (result as NSString).replacingCharacters(in: match.range, with: inner)
        }
        return result.replacingOccurrences(of: "<\(tag)>", with: "").replacingOccurrences(of: "</\(tag)>", with: "")
    }

    private static func splitContentByArtifacts(content: String, artifacts: [Artifact]) -> [MessageContentSegment] {
        guard !artifacts.isEmpty,
              let regex = try? NSRegularExpression(pattern: "\\[\\[ARTIFACT:([^\\]]+)\\]\\]") else {
            return [.text(content)]
        }

        let artifactMap = Dictionary(uniqueKeysWithValues: artifacts.map { ($0.id, $0) })
        let nsContent = content as NSString
        let matches = regex.matches(in: content, range: NSRange(location: 0, length: nsContent.length))
        var segments: [MessageContentSegment] = []
        var location = 0

        for match in matches {
            if match.range.location > location {
                segments.append(.text(nsContent.substring(with: NSRange(location: location, length: match.range.location - location))))
            }

            let identifier = nsContent.substring(with: match.range(at: 1))
            if let artifact = artifactMap[identifier] {
                segments.append(.artifact(artifact))
            } else {
                segments.append(.text("[[ARTIFACT:\(identifier)]]"))
            }

            location = match.range.location + match.range.length
        }

        if location < nsContent.length {
            segments.append(.text(nsContent.substring(from: location)))
        }

        return segments.isEmpty ? [.text(content)] : segments
    }
}

private enum MarkdownFixer {
    static func fix(_ markdown: String, isStreaming: Bool = false) -> String {
        var content = markdown.replacingOccurrences(of: "^# (.*)$", with: "## $1", options: .regularExpression)

        if isStreaming || isLikelyIncomplete(content) {
            content = completeMarkdownTags(content).replacingOccurrences(of: "<[^>]*$", with: "", options: .regularExpression)
        }

        return content
    }

    private static func completeMarkdownTags(_ markdown: String) -> String {
        var content = markdown

        if content.components(separatedBy: "```").count % 2 == 0 {
            content += "\n```"
        }

        let inlineCodeCount = content.filter { $0 == "`" }.count
        if inlineCodeCount % 2 == 1,
           let lastTickIndex = content.lastIndex(of: "`"),
           content[content.index(after: lastTickIndex)...].trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false {
            content += "`"
        }

        let boldCount = content.components(separatedBy: "**").count - 1
        if boldCount % 2 == 1,
           let range = content.range(of: "**", options: .backwards),
           content[range.upperBound...].trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false {
            content += "**"
        }

        let openBrackets = content.filter { $0 == "[" }.count
        let closeBrackets = content.filter { $0 == "]" }.count
        if openBrackets > closeBrackets,
           content.range(of: "\\[[^\\]]+$", options: .regularExpression) != nil {
            content += "](...)"
        }

        if let lastLine = content.split(separator: "\n", omittingEmptySubsequences: false).last,
           lastLine.contains("|"),
           lastLine.split(separator: "|").count > 2,
           !lastLine.trimmingCharacters(in: .whitespaces).hasSuffix("|") {
            content += " |"
        }

        return content
    }

    private static func isLikelyIncomplete(_ markdown: String) -> Bool {
        let trimmed = markdown.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }

        let codeFenceCount = trimmed.components(separatedBy: "```").count - 1
        let boldCount = trimmed.components(separatedBy: "**").count - 1
        let inlineCodeCount = trimmed.filter { $0 == "`" }.count
        let openBrackets = trimmed.filter { $0 == "[" }.count
        let closeBrackets = trimmed.filter { $0 == "]" }.count

        return codeFenceCount % 2 == 1 ||
            boldCount % 2 == 1 ||
            inlineCodeCount % 2 == 1 ||
            (openBrackets > closeBrackets && trimmed.range(of: "\\[[^\\]]+$", options: .regularExpression) != nil) ||
            trimmed.range(of: "<[a-zA-Z][^>]*$", options: .regularExpression) != nil
    }
}

private extension ChatMessage {
    var renderedTextContent: String {
        if let parts, !parts.isEmpty {
            let partText = parts.compactMap { part -> String? in
                switch part.type {
                case "text", "reasoning", "snapshot":
                    return part.text ?? part.summary
                case "tool_result":
                    return part.content?.prettyString
                default:
                    return nil
                }
            }.joined(separator: "\n")
            if !partText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return partText
            }
        }

        return textContent
    }
}

private extension Array where Element == MessageContentBlock {
    var textContent: String {
        compactMap { block -> String? in
            switch block {
            case .text(let text):
                return text.text
            case .thinking(let thinking):
                return thinking.thinking
            default:
                return nil
            }
        }.joined(separator: "\n")
    }
}

private extension Artifact {
    init(webArtifact: MessageContentBlock.ArtifactBlock.InlineArtifact) {
        self.init(
            id: webArtifact.identifier,
            type: Artifact.ArtifactType(webType: webArtifact.type, language: webArtifact.language),
            title: webArtifact.title ?? "Artifact",
            content: webArtifact.content,
            language: webArtifact.language ?? webArtifact.type
        )
    }
}
