import SwiftUI

struct ChatView: View {
    @EnvironmentObject var conversationManager: ConversationManager
    @EnvironmentObject var modelsStore: ModelsStore
    @EnvironmentObject var apiClient: APIClient
    @EnvironmentObject var ageGateStore: AgeGateStore
    @StateObject private var composer = ChatComposerController()
    @State private var messageText = ""
    @State private var selectedAttachments: [ComposerAttachment] = []
    @State private var showingModelSelector = false
    @FocusState private var isMessageInputFocused: Bool
    let projectName: String?
    let onNewChat: (String?) -> Void

    private var conversation: Conversation? {
        conversationManager.currentConversation
    }

    private var messages: [ChatMessage] {
        conversation?.messages ?? []
    }

    private var activeModelId: String? {
        conversation?.modelId ?? conversationManager.selectedModelId ?? modelsStore.selectedModelId
    }

    private var activeModelConfig: ModelConfigItem? {
        activeModelId.flatMap { modelsStore.model(withId: $0) }
    }

    private var activeModelName: String {
        if let activeModelId {
            return activeModelConfig?.name ?? activeModelId
        }
        if let tier = conversation?.modelTier ?? modelsStore.selectedModelTier {
            return tier.capitalized
        }
        return "Auto"
    }

    private var currentResponse: PlatformResponse? {
        conversation?.latestResponse
    }

    private var isStreaming: Bool {
        conversation.map { conversationManager.isStreaming($0.id) } ?? false
    }

    var body: some View {
        VStack(spacing: 0) {
            MessageListView(
                messages: messages,
                response: currentResponse,
                activityLabel: conversationManager.turnActivityLabel(for: conversation?.id),
                taskActivity: conversationManager.currentTaskActivity,
                taskInteraction: conversationManager.currentTaskInteraction,
                connectorApproval: conversationManager.currentConnectorApproval,
                isLoadingConversation: conversationManager.loadingConversationID == conversation?.id,
                hasMoreMessages: conversation?.hasMoreMessages == true,
                isLoadingEarlierMessages: conversationManager.isLoadingEarlierMessages,
                emptyState: AnyView(ChatEmptyState(projectName: projectName)),
                onLoadEarlierMessages: { Task { await conversationManager.loadEarlierMessages() } },
                onAnswerTaskQuestions: { answers in Task { await conversationManager.answerCurrentTaskQuestions(answers) } },
                onResolveTaskApproval: { resolution in Task { await conversationManager.resolveCurrentTaskApproval(resolution) } },
                onRefreshTaskInteraction: { Task { await conversationManager.refreshCurrentTaskInteraction() } },
                onResolveConnectorApproval: { resolution in Task { await conversationManager.resolveCurrentConnectorApproval(resolution) } },
                onContinueConnectorApproval: { Task { await conversationManager.continueCurrentConnectorApproval() } },
                onRefreshConnectorApproval: { Task { await conversationManager.refreshCurrentConnectorApproval() } },
                onRetry: { message in Task { await conversationManager.regenerateAssistantMessage(message.id) } },
                onEdit: { message, text in Task { await conversationManager.editUserMessage(message.id, text: text) } }
            )
            .id(conversation?.id)

            if let machineResponse = currentResponse, machineResponse.provenance?.site == "machine", !machineResponse.isActive {
                HStack(spacing: 10) {
                    Image(systemName: "desktopcomputer")
                        .foregroundStyle(Color.polychat.textMuted)
                    Text("Last ran on \(machineResponse.provenance?.vendor ?? "another machine")")
                        .font(.caption)
                        .foregroundStyle(Color.polychat.textMuted)
                    Spacer()
                    Button("Continue here") {
                        conversationManager.setTierForCurrentConversation("medium")
                    }
                    .font(.caption.weight(.semibold))
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 6)
            }

            ToolApprovalBatchBar()

            MessageInputView(
                messageText: $messageText,
                selectedAttachments: $selectedAttachments,
                inputFocus: $isMessageInputFocused,
                isUploadingAttachments: composer.isUploading,
                isRecordingVoice: composer.isRecording,
                isTranscribingVoice: composer.isTranscribing,
                notice: composer.error ?? modelsStore.readinessMessage(for: activeModelId),
                activeModelName: activeModelName,
                activeModelProvider: activeModelConfig?.provider,
                isRunActive: isStreaming || currentResponse?.isActive == true,
                isCancellationPending: currentResponse?.status == "cancelling",
                onFilesPicked: { files in
                    Task {
                        selectedAttachments += await composer.upload(files, apiClient: apiClient)
                    }
                },
                onVoiceTapped: {
                    isMessageInputFocused = false
                    Task {
                        if let text = await composer.toggleDictation(apiClient: apiClient) {
                            messageText += messageText.isEmpty ? text : "\n\(text)"
                        }
                    }
                },
                onModelTapped: {
                    isMessageInputFocused = false
                    showingModelSelector = true
                },
                onStopRun: { Task { await conversationManager.cancelCurrentRun() } },
                sendMessage: sendMessage
            )
        }
        .background(Color.polychat.background)
        .navigationTitle(conversation?.title ?? "New chat")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    isMessageInputFocused = false
                    onNewChat(conversation?.projectId)
                } label: {
                    Image(systemName: "square.and.pencil")
                }
                .accessibilityLabel("New chat")
            }
        }
        .sheet(isPresented: $showingModelSelector) {
            ModelSelectorView(
                onSelectModel: { modelId in
                    conversationManager.setModelForCurrentConversation(modelId)
                },
                onSelectTier: { tier in
                    conversationManager.setTierForCurrentConversation(tier)
                },
                validateSelection: { model in
                    let decision = ModelContinuity.evaluate(
                        model: model,
                        hasConversationHistory: !messages.isEmpty,
                        activeResponse: currentResponse,
                        attachmentTypes: selectedAttachments.map(\.type)
                    )
                    return decision.allowsSelection ? nil : decision.reason
                }
            )
        }
        .sheet(isPresented: $ageGateStore.isPrompting) {
            AgeGateSheet()
        }
        .task(id: currentResponse.map { "\($0.id):\($0.attempt):\($0.status)" }) {
            await conversationManager.observeCurrentRun()
        }
        .task(id: activeModelId) {
            await modelsStore.refreshModelsIfNeeded(for: activeModelId)
        }
        .onChange(of: isStreaming) { _, streaming in
            if !streaming {
                Task { await conversationManager.submitApprovalsIfReady() }
            }
        }
    }

    private func sendMessage() {
        let text = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        let attachments = selectedAttachments
        let requestedModelId = activeModelId
        guard !text.isEmpty || !attachments.isEmpty, !composer.isUploading else { return }

        Task { @MainActor in
            await modelsStore.refreshModelsIfNeeded(for: requestedModelId)
            guard modelsStore.readinessMessage(for: requestedModelId) == nil else {
                return
            }

            guard await ageGateStore.ensureConfirmed() else {
                return
            }

            composer.error = nil
            messageText = ""
            selectedAttachments = []

            try? await conversationManager.addMessage(ChatComposerController.message(text: text, attachments: attachments))
        }
    }
}

private struct ChatEmptyState: View {
    let projectName: String?

    var body: some View {
        VStack(spacing: 14) {
            PolyMark(size: 64)
            Text(projectName.map { "New conversation in \($0)" } ?? "What's on your mind?")
                .font(.polychatDisplay(.title2))
                .multilineTextAlignment(.center)
            Text(projectName == nil
                 ? "Ask anything. Replies sync with Polychat on your other devices."
                 : "Everyone in the project can see this conversation.")
                .font(.subheadline)
                .foregroundStyle(Color.polychat.textMuted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 120)
        .padding(.horizontal, 24)
    }
}
