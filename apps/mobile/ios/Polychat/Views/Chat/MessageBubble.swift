import SwiftUI
struct MessageBubble: View {
    let message: ChatMessage
    let conversationModelId: String?
    @EnvironmentObject var conversationManager: ConversationManager
    @EnvironmentObject var modelsStore: ModelsStore
    @State private var isEditingUserMessage = false
    @State private var editedMessageText = ""

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if message.role == "user" {
                Spacer(minLength: 80)
            }

            if message.role == "assistant" && !message.isCompactionMarker {
                ModelIconView(
                    modelName: assistantModel?.name ?? assistantModelId ?? "Assistant",
                    provider: assistantModel?.provider,
                    size: 28
                )
                .padding(.top, 2)
            }

            VStack(alignment: message.role == "user" ? .trailing : .leading, spacing: 8) {
                if message.renderedTextContent.isEmpty && message.role == "assistant" && !message.isCompactionMarker {
                    HStack(spacing: 8) {
                        ProgressView()
                            .scaleEffect(0.8)
                        Text(
                            conversationManager.turnActivityLabel(for: message.completionId)
                                ?? "Generating response..."
                        )
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
                        .contextMenu {
                            if canReact {
                                ForEach(Self.reactionPalette, id: \.self) { emoji in
                                    Button(emoji) {
                                        react(emoji)
                                    }
                                }
                            }
                        }
                }

                if !reactionSummaries.isEmpty {
                    HStack(spacing: 6) {
                        ForEach(reactionSummaries, id: \.emoji) { summary in
                            Button {
                                react(summary.emoji)
                            } label: {
                                Text(summary.count > 1 ? "\(summary.emoji) \(summary.count)" : summary.emoji)
                                    .font(.caption)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 3)
                                    .background(
                                        Capsule().fill(
                                            summary.mine
                                                ? Color.polychat.messageUserBackground.opacity(0.65)
                                                : Color.gray.opacity(0.15)
                                        )
                                    )
                            }
                            .buttonStyle(.plain)
                            .disabled(!canReact)
                            .accessibilityLabel(summary.mine ? "Remove \(summary.emoji)" : "React \(summary.emoji)")
                        }
                    }
                }

                if shouldShowActions {
                    HStack(spacing: 12) {
                        if message.role == "assistant" && !message.isCompactionMarker {
                            Button(action: regenerateMessage) {
                                Image(systemName: "arrow.clockwise")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .accessibilityLabel("Retry message")
                        }

                        if message.role == "user" {
                            Button(action: beginEditingUserMessage) {
                                Image(systemName: "pencil")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .accessibilityLabel("Edit message")
                        }

                        if canBranch {
                            Button(action: branchConversation) {
                                Image(systemName: "arrow.triangle.branch")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .accessibilityLabel("Branch conversation")
                        }

                        Button(action: copyMessage) {
                            Image(systemName: "doc.on.doc")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .accessibilityLabel("Copy message")
                    }
                }
            }

            if message.role != "user" {
                Spacer(minLength: 0)
            }
        }
        .frame(maxWidth: .infinity)
        .alert("Edit Message", isPresented: $isEditingUserMessage) {
            TextField("Message", text: $editedMessageText)
            Button("Cancel", role: .cancel) {}
            Button("Save") {
                saveEditedUserMessage()
            }
            .disabled(editedMessageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        } message: {
            Text("Saving will rerun the conversation from this message and remove later replies.")
        }
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

    private var shouldShowActions: Bool {
        !message.renderedTextContent.isEmpty
    }

    private var canBranch: Bool {
        !message.isCompactionMarker && (message.role == "user" || message.role == "assistant")
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
        Task {
            await conversationManager.regenerateAssistantMessage(message.id)
        }
    }

    private func beginEditingUserMessage() {
        editedMessageText = message.textContent
        isEditingUserMessage = true
    }

    private func saveEditedUserMessage() {
        let newText = editedMessageText
        Task {
            await conversationManager.editUserMessage(message.id, text: newText)
        }
    }

    private func branchConversation() {
        Task {
            await conversationManager.branchConversation(from: message.id)
        }
    }

    private func copyMessage() {
        UIPasteboard.general.string = message.renderedTextContent
    }

    private static let reactionPalette = ["👍", "👎", "❤️", "🎉", "😂", "👀", "✅", "🙏"]

    private var canReact: Bool {
        message.role == "assistant" && !message.isCompactionMarker
    }

    private struct ReactionSummary {
        let emoji: String
        let count: Int
        let mine: Bool
    }

    private var reactionSummaries: [ReactionSummary] {
        let reactions = message.data?.reactions ?? []
        var order: [String] = []
        var counts: [String: Int] = [:]
        var mine: Set<String> = []

        for reaction in reactions {
            if counts[reaction.emoji] == nil {
                order.append(reaction.emoji)
            }
            counts[reaction.emoji, default: 0] += 1
            if reaction.actor == "person" {
                mine.insert(reaction.emoji)
            }
        }

        return order.map { ReactionSummary(emoji: $0, count: counts[$0] ?? 0, mine: mine.contains($0)) }
    }

    private func react(_ emoji: String) {
        let remove = reactionSummaries.contains { $0.emoji == emoji && $0.mine }

        Task {
            await conversationManager.react(to: message, emoji: emoji, remove: remove)
        }
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
