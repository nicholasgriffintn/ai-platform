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
                    MarkdownText(
                        content: reasoning.content,
                        isUser: false,
                        font: .caption,
                        foregroundColor: Color(light: Color.polychat.zinc500, dark: Color.polychat.zinc400),
                        lineSpacing: 3,
                        paragraphSpacing: 8,
                        splitsSingleNewlinesIntoParagraphs: true
                    )
                    .frame(maxWidth: 640, alignment: .leading)
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
