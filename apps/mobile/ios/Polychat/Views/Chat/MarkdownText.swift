import SwiftUI

struct MarkdownText: View {
    let content: String
    let isUser: Bool
    var font: Font = .body
    var foregroundColor: Color = .primary
    var lineSpacing: CGFloat = 4
    var paragraphSpacing: CGFloat? = nil
    var splitsSingleNewlinesIntoParagraphs: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: paragraphSpacing ?? (isUser ? 6 : 14)) {
            ForEach(MarkdownBlock.blocks(from: MarkdownFixer.fix(content))) { block in
                switch block.kind {
                case .markdown:
                    MarkdownProse(
                        text: block.content,
                        font: font,
                        foregroundColor: foregroundColor,
                        lineSpacing: lineSpacing,
                        splitsSingleNewlinesIntoParagraphs: splitsSingleNewlinesIntoParagraphs
                    )
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
    let font: Font
    let foregroundColor: Color
    let lineSpacing: CGFloat
    let splitsSingleNewlinesIntoParagraphs: Bool

    private var paragraphs: [String] {
        let separator = splitsSingleNewlinesIntoParagraphs ? "\n" : "\n\n"
        return text
            .components(separatedBy: separator)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(Array(paragraphs.enumerated()), id: \.offset) { _, paragraph in
                if let attributedString = try? AttributedString(markdown: markdownWithHardLineBreaks(paragraph)) {
                    Text(attributedString)
                } else {
                    Text(paragraph)
                }
            }
        }
        .font(font)
        .lineSpacing(lineSpacing)
        .foregroundColor(foregroundColor)
        .textSelection(.enabled)
    }

    private func markdownWithHardLineBreaks(_ paragraph: String) -> String {
        paragraph
            .components(separatedBy: "\n")
            .map { line in
                line.isEmpty || line.hasSuffix("  ") ? line : "\(line)  "
            }
            .joined(separator: "\n")
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
