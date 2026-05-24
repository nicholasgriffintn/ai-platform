import SwiftUI

struct MessageContentView: View {
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

extension Array where Element == MessageContentBlock {
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

extension Artifact {
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
