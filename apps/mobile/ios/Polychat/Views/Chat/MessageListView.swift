import SwiftUI
struct MessageListView: View {
    let messages: [ChatMessage]
    let conversationModelId: String?
    let run: ChatRun?
    let taskActivity: ProjectTaskActivityTimeline?
    let taskInteraction: ProjectTaskInteractionControl?
    let connectorApproval: ConnectorApprovalControl?
    let isLoadingConversation: Bool
    let hasMoreMessages: Bool
    let isLoadingEarlierMessages: Bool
    let onLoadEarlierMessages: () -> Void
    let onAnswerTaskQuestions: ([UserQuestionAnswer]) -> Void
    let onResolveTaskApproval: (String) -> Void
    let onRefreshTaskInteraction: () -> Void
    let onResolveConnectorApproval: (String) -> Void
    let onContinueConnectorApproval: () -> Void
    let onRefreshConnectorApproval: () -> Void
    let onSuggestionSelected: (String) -> Void
    let onDismissKeyboard: () -> Void
    
    var body: some View {
        ScrollView {
            ScrollViewReader { proxy in
                LazyVStack(spacing: 22) {
                    if hasMoreMessages {
                        Button(action: onLoadEarlierMessages) {
                            if isLoadingEarlierMessages {
                                ProgressView()
                            } else {
                                Text("Load earlier messages")
                            }
                        }
                        .buttonStyle(.bordered)
                        .disabled(isLoadingEarlierMessages)
                    }
                    if let taskActivity {
                        ProjectTaskActivityTimelineView(timeline: taskActivity)
                    }
                    if let run, run.status != "succeeded" {
                        ChatRunStatusRow(run: run)
                    }
                    if let taskInteraction {
                        ProjectTaskInteractionCard(
                            control: taskInteraction,
                            onAnswerQuestions: onAnswerTaskQuestions,
                            onResolveApproval: onResolveTaskApproval,
                            onRefresh: onRefreshTaskInteraction
                        )
                    }
                    if let connectorApproval {
                        ConnectorApprovalCard(
                            control: connectorApproval,
                            onResolve: onResolveConnectorApproval,
                            onContinue: onContinueConnectorApproval,
                            onRefresh: onRefreshConnectorApproval
                        )
                    }
                    if isLoadingConversation {
                        LoadingConversationMessagesView()
                            .padding(.top, 150)
                    } else if messages.isEmpty {
                        WelcomePromptView(onSuggestionSelected: onSuggestionSelected)
                            .padding(.top, 150)
                    } else {
                        ForEach(messages) { message in
                            if message.isVisibleCompactionStatus {
                                CompactionStatusRow(
                                    label: message.compactionStatusLabel,
                                    detail: message.compactionCoverageDetail
                                )
                                    .id(message.id)
                            } else {
                                MessageBubble(message: message, conversationModelId: conversationModelId)
                                    .id(message.id)
                            }
                        }
                    }
                }
                .frame(maxWidth: 860)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 28)
                .padding(.top, messages.isEmpty ? 28 : 72)
                .padding(.bottom, 28)
                .onChange(of: messages.count) {
                    guard !isLoadingEarlierMessages else {
                        return
                    }

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
        .contentShape(Rectangle())
        .onTapGesture(perform: onDismissKeyboard)
        #if os(iOS)
        .scrollDismissesKeyboard(.interactively)
        #endif
    }
}

private struct ChatRunStatusRow: View {
    let run: ChatRun

    private var presentation: ChatRunPresentation {
        ChatRunPresentation.resolve(run)
    }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon)
                .foregroundStyle(colour)
            VStack(alignment: .leading, spacing: 2) {
                Text(presentation.label)
                    .font(.subheadline.weight(.semibold))
                Text(presentation.detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(12)
        .background(colour.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    private var colour: Color {
        switch presentation.tone {
        case .active:
            return .blue
        case .attention:
            return .orange
        case .danger:
            return .red
        case .neutral:
            return .secondary
        case .success:
            return .green
        }
    }

    private var icon: String {
        switch presentation.tone {
        case .active:
            return "bolt.horizontal.circle"
        case .attention:
            return "exclamationmark.circle"
        case .danger:
            return "xmark.circle"
        case .neutral:
            return "stop.circle"
        case .success:
            return "checkmark.circle"
        }
    }
}

private struct CompactionStatusRow: View {
    let label: String
    let detail: String?

    var body: some View {
        HStack(spacing: 12) {
            Rectangle()
                .fill(Color.polychat.border)
                .frame(height: 1)
            VStack(spacing: 2) {
                Label(label, systemImage: "doc.text")
                    .font(.subheadline.weight(.semibold))
                if let detail {
                    Text(detail)
                        .font(.caption)
                }
            }
            .foregroundStyle(.secondary)
            .lineLimit(1)
            Rectangle()
                .fill(Color.polychat.border)
                .frame(height: 1)
        }
        .padding(.vertical, 8)
        .accessibilityElement(children: .combine)
    }
}

private struct LoadingConversationMessagesView: View {
    var body: some View {
        VStack(spacing: 12) {
            ProgressView()
            Text("Loading conversation...")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }
}

private struct WelcomePromptView: View {
    private let suggestions = [
        ("shield", "Existential inquiry", "What makes an answer useful when the question is ambiguous?"),
        ("face.smiling", "Satirical news", "Write a short satirical news brief about robots asking for coffee breaks.")
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
