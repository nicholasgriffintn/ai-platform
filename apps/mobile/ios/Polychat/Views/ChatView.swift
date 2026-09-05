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
    @State private var showingContext = false
    @State private var chatSettings = ChatSettings.default
    @StateObject private var voiceRecorder = VoiceRecorder()
    @FocusState private var isMessageInputFocused: Bool

    private var messages: [ChatMessage] {
        conversationManager.currentConversation?.messages ?? []
    }

    private var activeModelId: String? {
        conversationManager.currentConversation?.modelId ??
        conversationManager.selectedModelId ??
        modelsStore.selectedModelId
    }

    private var activeModelConfig: ModelConfigItem? {
        guard let activeModelId else {
            return nil
        }

        return modelsStore.model(withId: activeModelId)
    }

    private var activeModelName: String {
        guard let activeModelId else {
            return "Select model"
        }

        return activeModelConfig?.name ?? activeModelId
    }

    private var activeModelProvider: String? {
        activeModelConfig?.provider
    }

    private var modelReadinessMessage: String? {
        guard activeModelId != nil else { return nil }
        guard let activeModelConfig else {
            return "Your selected model is no longer available to this account. Choose another model before sending."
        }
        if let readiness = activeModelConfig.readiness {
            if !readiness.isFresh() {
                return "Model readiness has expired. Refresh the model list before sending."
            }
            return readiness.isReady ? nil : readiness.reason
        }
        return activeModelConfig.isAvailableForSelection
            ? nil
            : "This model cannot run under the current account and provider policy."
    }

    private var currentRun: ChatRun? {
        conversationManager.currentConversation?.latestRun
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
                run: currentRun,
                taskActivity: conversationManager.currentTaskActivity,
                taskInteraction: conversationManager.currentTaskInteraction,
                connectorApproval: conversationManager.currentConnectorApproval,
                isLoadingConversation: conversationManager.loadingConversationID == conversationManager.currentConversation?.id,
                hasMoreMessages: conversationManager.currentConversation?.hasMoreMessages == true,
                isLoadingEarlierMessages: conversationManager.isLoadingEarlierMessages,
                onLoadEarlierMessages: {
                    Task {
                        await conversationManager.loadEarlierMessages()
                    }
                },
                onAnswerTaskQuestions: { answers in
                    Task {
                        await conversationManager.answerCurrentTaskQuestions(answers)
                    }
                },
                onResolveTaskApproval: { resolution in
                    Task {
                        await conversationManager.resolveCurrentTaskApproval(resolution)
                    }
                },
                onRefreshTaskInteraction: {
                    Task {
                        await conversationManager.refreshCurrentTaskInteraction()
                    }
                },
                onResolveConnectorApproval: { resolution in
                    Task {
                        await conversationManager.resolveCurrentConnectorApproval(resolution)
                    }
                },
                onContinueConnectorApproval: {
                    Task {
                        await conversationManager.continueCurrentConnectorApproval()
                    }
                },
                onRefreshConnectorApproval: {
                    Task {
                        await conversationManager.refreshCurrentConnectorApproval()
                    }
                },
                onSuggestionSelected: { suggestion in
                    messageText = suggestion
                },
                onDismissKeyboard: {
                    isMessageInputFocused = false
                }
            )
            MessageInputView(
                messageText: $messageText,
                selectedAttachments: $selectedAttachments,
                inputFocus: $isMessageInputFocused,
                isUploadingAttachments: isUploadingAttachments,
                isRecordingVoice: voiceRecorder.isRecording,
                isTranscribingVoice: isTranscribingVoice,
                uploadError: uploadError,
                voiceError: voiceError,
                activeModelName: activeModelName,
                activeModelProvider: activeModelProvider,
                modelReadinessMessage: modelReadinessMessage,
                isRunActive: currentRun?.isActive == true,
                isCancellationPending: currentRun?.status == "cancelling",
                onFilesPicked: uploadFiles,
                onVoiceTapped: {
                    isMessageInputFocused = false
                    toggleVoiceRecording()
                },
                onModelTapped: {
                    isMessageInputFocused = false
                    showingModelSelector = true
                },
                onSettingsTapped: {
                    isMessageInputFocused = false
                    showingChatSettings = true
                },
                onStopRun: {
                    Task {
                        await conversationManager.cancelCurrentRun()
                    }
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
            ToolbarItem(placement: .topBarTrailing) {
                Button(action: {
                    isMessageInputFocused = false
                    _ = conversationManager.startNewConversation()
                }) {
                    Image(systemName: "square.and.pencil")
                }
                .accessibilityLabel("New Message")
            }

            ToolbarItem(placement: .secondaryAction) {
                Button(action: {
                    isMessageInputFocused = false
                    showingContext = true
                }) {
                    Label("Context", systemImage: "book.pages")
                }
                .disabled(currentRun?.context == nil && currentRun?.usage == nil)
            }

            ToolbarItem(placement: .secondaryAction) {
                Button(action: {
                    isMessageInputFocused = false
                    showingArtifacts = true
                }) {
                    Label("Artifacts", systemImage: "doc.text")
                }
                .disabled(allArtifacts.isEmpty)
            }
        }
        .sheet(isPresented: $showingModelSelector) {
            ModelSelectorView(
                onSelectModel: { modelId in
                    conversationManager.setModelForCurrentConversation(modelId)
                    chatSettings.serviceTier = nil
                },
                validateSelection: { model in
                    let decision = ModelContinuity.evaluate(
                        model: model,
                        hasConversationHistory: !messages.isEmpty,
                        activeRun: currentRun,
                        attachmentTypes: selectedAttachments.map(\.type)
                    )
                    return decision.allowsSelection ? nil : decision.reason
                }
            )
        }
        .sheet(isPresented: $showingChatSettings) {
            ChatSettingsView(settings: $chatSettings, modelConfig: activeModelConfig)
        }
        .sheet(isPresented: $showingArtifacts) {
            ArtifactsView(artifacts: allArtifacts)
        }
        .sheet(isPresented: $showingContext) {
            if let run = currentRun {
                ChatContextView(context: run.context, usage: run.usage)
            }
        }
        .task(id: currentRun.map { "\($0.id):\($0.attempt)" }) {
            await conversationManager.observeCurrentRun()
        }
    }
    
    private func sendMessage() {
        let text = messageText
        let attachments = selectedAttachments
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !attachments.isEmpty else { return }
        guard !isUploadingAttachments else { return }
        if let modelReadinessMessage {
            uploadError = modelReadinessMessage
            return
        }

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
            do {
                let recordingURL = try voiceRecorder.stop()
                transcribeRecording(at: recordingURL)
            } catch {
                voiceError = error.localizedDescription
            }
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
                defer {
                    try? FileManager.default.removeItem(at: url)
                }

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
