import SwiftUI

struct MessageListView: View {
    let messages: [ChatMessage]
    let response: PlatformResponse?
    let activityLabel: String?
    let taskActivity: ProjectTaskActivityTimeline?
    let taskInteraction: ProjectTaskInteractionControl?
    let connectorApproval: ConnectorApprovalControl?
    let isLoadingConversation: Bool
    let hasMoreMessages: Bool
    let isLoadingEarlierMessages: Bool
    let emptyState: AnyView
    let onLoadEarlierMessages: () -> Void
    let onAnswerTaskQuestions: ([UserQuestionAnswer]) -> Void
    let onResolveTaskApproval: (String) -> Void
    let onRefreshTaskInteraction: () -> Void
    let onResolveConnectorApproval: (String) -> Void
    let onContinueConnectorApproval: () -> Void
    let onRefreshConnectorApproval: () -> Void
    let onRetry: (ChatMessage) -> Void
    let onEdit: (ChatMessage, String) -> Void

    @State private var isNearBottom = true
    @State private var position = ScrollPosition(edge: .bottom)

    private var scrollSignature: String {
        "\(messages.count):\(messages.last?.id ?? ""):\(messages.last?.textContent.count ?? 0):\(messages.last?.status ?? "")"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if hasMoreMessages {
                    Button(action: onLoadEarlierMessages) {
                        if isLoadingEarlierMessages {
                            ProgressView()
                        } else {
                            Text("Load earlier messages")
                                .font(.footnote.weight(.medium))
                        }
                    }
                    .buttonStyle(.bordered)
                    .frame(maxWidth: .infinity)
                    .disabled(isLoadingEarlierMessages)
                }

                if isLoadingConversation && messages.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.top, 120)
                } else if messages.isEmpty {
                    emptyState
                } else {
                    ForEach(messages) { message in
                        row(for: message)
                            .id(message.id)
                            .padding(.top, message.role == "user" ? 8 : 0)
                    }
                }

                if let taskActivity {
                    ProjectTaskActivityTimelineView(timeline: taskActivity)
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

                if let response, response.status != "completed", !response.isActive || response.isWaiting, !messages.isEmpty {
                    ResponseStatusRow(response: response)
                }

            }
            .frame(maxWidth: 760)
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 16)
            .padding(.vertical, 16)
        }
        .scrollPosition($position)
        .defaultScrollAnchor(.bottom)
        .scrollDismissesKeyboard(.interactively)
        .onScrollGeometryChange(for: Bool.self) { geometry in
            geometry.visibleRect.maxY >= geometry.contentSize.height - 120
        } action: { _, nearBottom in
            isNearBottom = nearBottom
        }
        .onChange(of: scrollSignature) {
            if isNearBottom {
                position.scrollTo(edge: .bottom)
            }
        }
        .onChange(of: isLoadingConversation) { _, loading in
            if !loading {
                position.scrollTo(edge: .bottom)
            }
        }
        .overlay(alignment: .bottom) {
            if !isNearBottom && !messages.isEmpty {
                Button {
                    withAnimation(.easeOut(duration: 0.25)) {
                        position.scrollTo(edge: .bottom)
                    }
                } label: {
                    Image(systemName: "arrow.down")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Color.polychat.text)
                        .frame(width: 36, height: 36)
                        .background(.regularMaterial, in: Circle())
                        .overlay(Circle().stroke(Color.polychat.border, lineWidth: 1))
                }
                .padding(.bottom, 8)
                .transition(.opacity.combined(with: .scale))
                .accessibilityLabel("Jump to latest")
            }
        }
        .background(Color.polychat.background)
    }

    @ViewBuilder
    private func row(for message: ChatMessage) -> some View {
        if message.isVisibleCompactionStatus {
            CompactionStatusRow(label: message.compactionStatusLabel, detail: message.compactionCoverageDetail)
        } else if !message.isCompactionMarker {
            MessageBubble(
                message: message,
                activityLabel: message.isAwaitingFirstToken ? activityLabel : nil,
                onRetry: { onRetry(message) },
                onEdit: { onEdit(message, $0) }
            )
        }
    }
}

private struct ResponseStatusRow: View {
    let response: PlatformResponse

    private var presentation: ResponsePresentation {
        ResponsePresentation.resolve(response)
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
                    .foregroundStyle(Color.polychat.textMuted)
            }
            Spacer()
        }
        .padding(12)
        .background(colour.opacity(0.1), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    private var colour: Color {
        switch presentation.tone {
        case .active: return Color.polychat.activeWork
        case .attention: return Color.polychat.attention
        case .danger: return Color.polychat.error
        case .neutral: return Color.polychat.textMuted
        case .success: return Color.polychat.success
        }
    }

    private var icon: String {
        switch presentation.tone {
        case .active: return "bolt.horizontal.circle"
        case .attention: return "exclamationmark.circle"
        case .danger: return "xmark.circle"
        case .neutral: return "stop.circle"
        case .success: return "checkmark.circle"
        }
    }
}

private struct CompactionStatusRow: View {
    let label: String
    let detail: String?

    var body: some View {
        HStack(spacing: 12) {
            Rectangle().fill(Color.polychat.border).frame(height: 1)
            VStack(spacing: 2) {
                Label(label, systemImage: "doc.text")
                    .font(.footnote.weight(.semibold))
                if let detail {
                    Text(detail).font(.caption2)
                }
            }
            .foregroundStyle(Color.polychat.textMuted)
            .lineLimit(1)
            Rectangle().fill(Color.polychat.border).frame(height: 1)
        }
        .padding(.vertical, 6)
        .accessibilityElement(children: .combine)
    }
}
