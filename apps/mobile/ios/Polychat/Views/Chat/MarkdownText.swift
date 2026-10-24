import SwiftUI

struct MarkdownText: View {
    let content: String
    let isUser: Bool
    var font: Font = .body
    var foregroundColor: Color = Color.polychat.text
    var lineSpacing: CGFloat = 4
    var paragraphSpacing: CGFloat? = nil
    var splitsSingleNewlinesIntoParagraphs: Bool = false
    var isStreaming: Bool = false

    private var blocks: [MarkdownBlock] {
        MarkdownBlock.blocks(from: MarkdownFixer.fix(content, isStreaming: isStreaming))
    }

    var body: some View {
        MarkdownBlocksView(
            blocks: blocks,
            style: MarkdownStyle(
                font: font,
                foregroundColor: foregroundColor,
                lineSpacing: lineSpacing,
                blockSpacing: paragraphSpacing ?? (isUser ? 8 : 12)
            )
        )
        .frame(maxWidth: .infinity, alignment: .leading)
        .textSelection(.enabled)
    }
}

private struct MarkdownStyle {
    let font: Font
    let foregroundColor: Color
    let lineSpacing: CGFloat
    let blockSpacing: CGFloat
}

private struct MarkdownBlocksView: View {
    let blocks: [MarkdownBlock]
    let style: MarkdownStyle

    var body: some View {
        VStack(alignment: .leading, spacing: style.blockSpacing) {
            ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
                MarkdownBlockView(block: block, style: style)
            }
        }
    }
}

private struct MarkdownBlockView: View {
    let block: MarkdownBlock
    let style: MarkdownStyle

    var body: some View {
        switch block {
        case .heading(let level, let text):
            InlineMarkdownText(markdown: text, font: headingFont(level), color: Color.polychat.text, lineSpacing: 2)
                .padding(.top, level <= 2 ? 6 : 2)
                .accessibilityAddTraits(.isHeader)
        case .paragraph(let text):
            InlineMarkdownText(markdown: text, font: style.font, color: style.foregroundColor, lineSpacing: style.lineSpacing)
        case .code(let language, let code):
            CodeBlockView(code: code, language: language)
        case .quote(let blocks):
            HStack(alignment: .top, spacing: 12) {
                RoundedRectangle(cornerRadius: 1.5)
                    .fill(Color.polychat.borderStrong)
                    .frame(width: 3)
                MarkdownBlocksView(
                    blocks: blocks,
                    style: MarkdownStyle(
                        font: style.font,
                        foregroundColor: Color.polychat.textMuted,
                        lineSpacing: style.lineSpacing,
                        blockSpacing: style.blockSpacing
                    )
                )
            }
            .fixedSize(horizontal: false, vertical: true)
        case .list(let ordered, let start, let items):
            VStack(alignment: .leading, spacing: 6) {
                ForEach(Array(items.enumerated()), id: \.offset) { offset, item in
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        marker(ordered: ordered, number: start + offset, checked: item.checked)
                            .font(style.font)
                            .foregroundStyle(Color.polychat.textMuted)
                            .frame(minWidth: ordered ? 22 : 12, alignment: .trailing)
                        MarkdownBlocksView(
                            blocks: item.blocks,
                            style: MarkdownStyle(
                                font: style.font,
                                foregroundColor: style.foregroundColor,
                                lineSpacing: style.lineSpacing,
                                blockSpacing: 6
                            )
                        )
                    }
                }
            }
        case .table(let table):
            MarkdownTableView(table: table)
        case .rule:
            Rectangle()
                .fill(Color.polychat.border)
                .frame(height: 1)
                .padding(.vertical, 4)
        }
    }

    @ViewBuilder
    private func marker(ordered: Bool, number: Int, checked: Bool?) -> some View {
        if let checked {
            Image(systemName: checked ? "checkmark.square.fill" : "square")
                .foregroundStyle(checked ? Color.polychat.success : Color.polychat.textMuted)
        } else if ordered {
            Text("\(number).")
                .monospacedDigit()
        } else {
            Text("•")
        }
    }

    private func headingFont(_ level: Int) -> Font {
        switch level {
        case 1: return .title2.weight(.bold)
        case 2: return .title3.weight(.semibold)
        case 3: return .headline
        default: return .subheadline.weight(.semibold)
        }
    }
}

private struct InlineMarkdownText: View {
    let markdown: String
    let font: Font
    let color: Color
    let lineSpacing: CGFloat

    var body: some View {
        Text(styled)
            .font(font)
            .foregroundStyle(color)
            .lineSpacing(lineSpacing)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var styled: AttributedString {
        var attributed = MarkdownInline.attributed(markdown)

        for run in attributed.runs {
            if run.inlinePresentationIntent?.contains(.code) == true {
                attributed[run.range].font = .system(.callout, design: .monospaced)
                attributed[run.range].backgroundColor = Color.polychat.surfaceElevated
            }
            if run.link != nil {
                attributed[run.range].foregroundColor = Color.polychat.primary
                attributed[run.range].underlineStyle = .single
            }
        }

        return attributed
    }
}

private struct CodeBlockView: View {
    let code: String
    let language: String?
    @State private var copied = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(language?.lowercased() ?? "code")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Color.polychat.textMuted)
                Spacer()
                Button {
                    UIPasteboard.general.string = code
                    copied = true
                } label: {
                    Label(copied ? "Copied" : "Copy", systemImage: copied ? "checkmark" : "doc.on.doc")
                        .font(.caption)
                        .foregroundStyle(Color.polychat.textMuted)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.polychat.surfaceElevated)

            ScrollView(.horizontal, showsIndicators: false) {
                Text(code)
                    .font(.system(.footnote, design: .monospaced))
                    .foregroundStyle(Color.polychat.text)
                    .padding(12)
                    .fixedSize(horizontal: true, vertical: true)
            }
        }
        .background(Color.polychat.surface)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(Color.polychat.border, lineWidth: 1)
        )
    }
}

private struct MarkdownTableView: View {
    let table: MarkdownTable

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            Grid(alignment: .leading, horizontalSpacing: 0, verticalSpacing: 0) {
                GridRow {
                    ForEach(table.headers.indices, id: \.self) { column in
                        cell(table.headers[column], column: column, isHeader: true)
                    }
                }
                ForEach(table.rows.indices, id: \.self) { row in
                    GridRow {
                        ForEach(table.headers.indices, id: \.self) { column in
                            cell(table.rows[row].value(at: column), column: column, isHeader: false)
                        }
                    }
                }
            }
            .background(Color.polychat.surface)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(Color.polychat.border, lineWidth: 1)
            )
        }
    }

    private func cell(_ text: String, column: Int, isHeader: Bool) -> some View {
        InlineMarkdownText(
            markdown: text,
            font: isHeader ? .subheadline.weight(.semibold) : .subheadline,
            color: isHeader ? Color.polychat.text : Color.polychat.textMuted,
            lineSpacing: 2
        )
        .multilineTextAlignment(alignment(column) == .trailing ? .trailing : .leading)
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .frame(minWidth: 110, maxWidth: 260, alignment: alignment(column) == .trailing ? .trailing : .leading)
        .background(isHeader ? Color.polychat.surfaceElevated : Color.clear)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color.polychat.border).frame(height: 1)
        }
    }

    private func alignment(_ column: Int) -> MarkdownTable.Alignment {
        table.alignments.indices.contains(column) ? table.alignments[column] : .leading
    }
}
