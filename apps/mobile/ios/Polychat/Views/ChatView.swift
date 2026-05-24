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
                .padding(.vertical, 28)
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
    @State private var showActions = false
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
                if message.textContent.isEmpty && message.role == "assistant" {
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
                    MarkdownText(content: displayContent, isUser: message.role == "user")
                        .padding(.horizontal, message.role == "user" ? 14 : 0)
                        .padding(.vertical, message.role == "user" ? 10 : 0)
                        .background(messageBackground)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }

                if !message.textContent.isEmpty && !message.textContent.hasPrefix("Error:") {
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
                    .opacity(showActions ? 1 : 0)
                }
            }
            .onTapGesture {
                withAnimation(.easeInOut(duration: 0.2)) {
                    showActions.toggle()
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
            return Color.polychat.messageUserBackground
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
        VStack(alignment: .leading, spacing: isUser ? 6 : 14) {
            ForEach(MarkdownBlock.blocks(from: content)) { block in
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
