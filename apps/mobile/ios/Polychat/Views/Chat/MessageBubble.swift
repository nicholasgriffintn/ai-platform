import SwiftUI
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
                            .accessibilityLabel("Retry message")
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
        Task {
            await conversationManager.regenerateAssistantMessage(message.id)
        }
    }

    private func copyMessage() {
        UIPasteboard.general.string = message.renderedTextContent
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
