import SwiftUI

struct ReasoningSectionView: View {
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

struct CitationListView: View {
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

struct SearchGroundingView: View {
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

struct AsyncInvocationStatusView: View {
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
