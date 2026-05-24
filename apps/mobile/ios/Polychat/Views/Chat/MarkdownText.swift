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

private struct MarkdownTable {
    let headers: [String]
    let rows: [[String]]
}

private extension Array where Element == String {
    func value(at index: Int) -> String {
        indices.contains(index) ? self[index] : ""
    }
}

private struct MarkdownBlock: Identifiable {
    enum Kind {
        case markdown
        case code(language: String?)
        case table(MarkdownTable)
    }

    let id = UUID()
    let kind: Kind
    let content: String

    static func blocks(from markdown: String) -> [MarkdownBlock] {
        var result: [MarkdownBlock] = []
        var currentMarkdown: [String] = []
        var currentCode: [String] = []
        var codeLanguage: String?
        var isInCodeBlock = false

        for line in markdown.components(separatedBy: .newlines) {
            if line.hasPrefix("```") {
                if isInCodeBlock {
                    result.append(MarkdownBlock(kind: .code(language: codeLanguage), content: currentCode.joined(separator: "\n")))
                    currentCode = []
                    codeLanguage = nil
                    isInCodeBlock = false
                } else {
                    if !currentMarkdown.isEmpty {
                        appendMarkdownBlocks(currentMarkdown, to: &result)
                        currentMarkdown = []
                    }
                    codeLanguage = String(line.dropFirst(3)).trimmingCharacters(in: .whitespacesAndNewlines)
                    isInCodeBlock = true
                }
                continue
            }

            if isInCodeBlock {
                currentCode.append(line)
            } else {
                currentMarkdown.append(line)
            }
        }

        if isInCodeBlock {
            result.append(MarkdownBlock(kind: .code(language: codeLanguage), content: currentCode.joined(separator: "\n")))
        } else if !currentMarkdown.isEmpty {
            appendMarkdownBlocks(currentMarkdown, to: &result)
        }

        return result.isEmpty ? [MarkdownBlock(kind: .markdown, content: markdown)] : result
    }

    private static func appendMarkdownBlocks(_ lines: [String], to result: inout [MarkdownBlock]) {
        var prose: [String] = []
        var index = 0

        func flushProse() {
            if !prose.isEmpty {
                result.append(MarkdownBlock(kind: .markdown, content: prose.joined(separator: "\n")))
                prose = []
            }
        }

        while index < lines.count {
            if let table = tableStarting(at: index, in: lines) {
                flushProse()
                result.append(MarkdownBlock(kind: .table(table.value), content: ""))
                index = table.nextIndex
            } else {
                prose.append(lines[index])
                index += 1
            }
        }

        flushProse()
    }

    private static func tableStarting(at index: Int, in lines: [String]) -> (value: MarkdownTable, nextIndex: Int)? {
        guard index + 1 < lines.count,
              isTableRow(lines[index]),
              isTableDivider(lines[index + 1]) else {
            return nil
        }

        let headers = cells(from: lines[index])
        guard !headers.isEmpty else {
            return nil
        }

        var rows: [[String]] = []
        var rowIndex = index + 2
        while rowIndex < lines.count, isTableRow(lines[rowIndex]) {
            rows.append(cells(from: lines[rowIndex]))
            rowIndex += 1
        }

        return (MarkdownTable(headers: headers, rows: rows), rowIndex)
    }

    private static func isTableRow(_ line: String) -> Bool {
        line.contains("|") && cells(from: line).count > 1
    }

    private static func isTableDivider(_ line: String) -> Bool {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        guard trimmed.contains("|") else {
            return false
        }

        let columns = cells(from: trimmed)
        return !columns.isEmpty && columns.allSatisfy { column in
            let cleaned = column.replacingOccurrences(of: ":", with: "").trimmingCharacters(in: .whitespaces)
            return cleaned.count >= 3 && cleaned.allSatisfy { $0 == "-" }
        }
    }

    private static func cells(from line: String) -> [String] {
        var trimmed = line.trimmingCharacters(in: .whitespaces)
        if trimmed.hasPrefix("|") {
            trimmed.removeFirst()
        }
        if trimmed.hasSuffix("|") {
            trimmed.removeLast()
        }

        return trimmed
            .split(separator: "|", omittingEmptySubsequences: false)
            .map { String($0).trimmingCharacters(in: .whitespaces) }
    }
}

private enum MarkdownFixer {
    static func fix(_ markdown: String, isStreaming: Bool = false) -> String {
        var content = markdown.replacingOccurrences(of: "^# (.*)$", with: "## $1", options: .regularExpression)

        if isStreaming || isLikelyIncomplete(content) {
            content = completeMarkdownTags(content).replacingOccurrences(of: "<[^>]*$", with: "", options: .regularExpression)
        }

        return content
    }

    private static func completeMarkdownTags(_ markdown: String) -> String {
        var content = markdown

        if content.components(separatedBy: "```").count % 2 == 0 {
            content += "\n```"
        }

        let inlineCodeCount = content.filter { $0 == "`" }.count
        if inlineCodeCount % 2 == 1,
           let lastTickIndex = content.lastIndex(of: "`"),
           content[content.index(after: lastTickIndex)...].trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false {
            content += "`"
        }

        let boldCount = content.components(separatedBy: "**").count - 1
        if boldCount % 2 == 1,
           let range = content.range(of: "**", options: .backwards),
           content[range.upperBound...].trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false {
            content += "**"
        }

        let openBrackets = content.filter { $0 == "[" }.count
        let closeBrackets = content.filter { $0 == "]" }.count
        if openBrackets > closeBrackets,
           content.range(of: "\\[[^\\]]+$", options: .regularExpression) != nil {
            content += "](...)"
        }

        if let lastLine = content.split(separator: "\n", omittingEmptySubsequences: false).last,
           lastLine.contains("|"),
           lastLine.split(separator: "|").count > 2,
           !lastLine.trimmingCharacters(in: .whitespaces).hasSuffix("|") {
            content += " |"
        }

        return content
    }

    private static func isLikelyIncomplete(_ markdown: String) -> Bool {
        let trimmed = markdown.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }

        let codeFenceCount = trimmed.components(separatedBy: "```").count - 1
        let boldCount = trimmed.components(separatedBy: "**").count - 1
        let inlineCodeCount = trimmed.filter { $0 == "`" }.count
        let openBrackets = trimmed.filter { $0 == "[" }.count
        let closeBrackets = trimmed.filter { $0 == "]" }.count

        return codeFenceCount % 2 == 1 ||
            boldCount % 2 == 1 ||
            inlineCodeCount % 2 == 1 ||
            (openBrackets > closeBrackets && trimmed.range(of: "\\[[^\\]]+$", options: .regularExpression) != nil) ||
            trimmed.range(of: "<[a-zA-Z][^>]*$", options: .regularExpression) != nil
    }
}
