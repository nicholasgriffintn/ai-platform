import Foundation

struct MarkdownTable: Equatable {
    let headers: [String]
    let rows: [[String]]
}

struct MarkdownBlock: Identifiable {
    enum Kind: Equatable {
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
            let content = prose.joined(separator: "\n")
            if !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                result.append(MarkdownBlock(kind: .markdown, content: content))
            }
            prose = []
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

enum MarkdownFixer {
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
           lastLine.split(separator: "|", omittingEmptySubsequences: false).count > 2,
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

extension Array where Element == String {
    func value(at index: Int) -> String {
        indices.contains(index) ? self[index] : ""
    }
}
