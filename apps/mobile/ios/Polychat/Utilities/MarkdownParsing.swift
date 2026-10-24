import Foundation

struct MarkdownTable: Equatable {
    enum Alignment: Equatable {
        case leading
        case center
        case trailing
    }

    let headers: [String]
    let alignments: [Alignment]
    let rows: [[String]]
}

struct MarkdownListItem: Equatable {
    let checked: Bool?
    let blocks: [MarkdownBlock]
}

indirect enum MarkdownBlock: Equatable {
    case heading(level: Int, text: String)
    case paragraph(String)
    case code(language: String?, code: String)
    case quote([MarkdownBlock])
    case list(ordered: Bool, start: Int, items: [MarkdownListItem])
    case table(MarkdownTable)
    case rule

    static func blocks(from markdown: String) -> [MarkdownBlock] {
        var parser = MarkdownBlockParser(lines: markdown.replacingOccurrences(of: "\r\n", with: "\n").components(separatedBy: "\n"))
        return parser.parse()
    }
}

private struct MarkdownBlockParser {
    private let lines: [String]
    private var index = 0

    init(lines: [String]) {
        self.lines = lines
    }

    mutating func parse() -> [MarkdownBlock] {
        var blocks: [MarkdownBlock] = []

        while index < lines.count {
            let line = lines[index]
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            if trimmed.isEmpty {
                index += 1
            } else if let fence = Self.fence(in: trimmed) {
                blocks.append(parseCode(fence: fence))
            } else if let heading = Self.heading(in: trimmed) {
                blocks.append(heading)
                index += 1
            } else if Self.isRule(trimmed) {
                blocks.append(.rule)
                index += 1
            } else if trimmed.hasPrefix(">") {
                blocks.append(parseQuote())
            } else if let table = parseTable() {
                blocks.append(.table(table))
            } else if Self.listMarker(in: line) != nil {
                blocks.append(parseList())
            } else {
                blocks.append(parseParagraph())
            }
        }

        return blocks
    }

    private mutating func parseCode(fence: (marker: String, language: String?)) -> MarkdownBlock {
        let indent = Self.indentation(of: lines[index])
        index += 1
        var code: [String] = []

        while index < lines.count {
            let line = lines[index]
            index += 1
            if line.trimmingCharacters(in: .whitespaces).hasPrefix(fence.marker) {
                break
            }
            code.append(String(line.dropFirst(min(indent, Self.indentation(of: line)))))
        }

        return .code(language: fence.language, code: code.joined(separator: "\n"))
    }

    private mutating func parseQuote() -> MarkdownBlock {
        var quoted: [String] = []

        while index < lines.count {
            let trimmed = lines[index].trimmingCharacters(in: .whitespaces)
            guard trimmed.hasPrefix(">") else {
                break
            }
            var content = trimmed.dropFirst()
            if content.first == " " {
                content = content.dropFirst()
            }
            quoted.append(String(content))
            index += 1
        }

        var nested = MarkdownBlockParser(lines: quoted)
        return .quote(nested.parse())
    }

    private mutating func parseList() -> MarkdownBlock {
        guard let first = Self.listMarker(in: lines[index]) else {
            return parseParagraph()
        }

        var items: [MarkdownListItem] = []

        while index < lines.count, let marker = Self.listMarker(in: lines[index]),
              marker.ordered == first.ordered, marker.indent == first.indent {
            var itemLines = [marker.content]
            index += 1

            while index < lines.count {
                let line = lines[index]
                let trimmed = line.trimmingCharacters(in: .whitespaces)

                if trimmed.isEmpty {
                    let nextIndex = index + 1
                    if nextIndex < lines.count, Self.indentation(of: lines[nextIndex]) > first.indent,
                       !lines[nextIndex].trimmingCharacters(in: .whitespaces).isEmpty {
                        itemLines.append("")
                        index += 1
                        continue
                    }
                    break
                }

                if let next = Self.listMarker(in: line), next.indent <= first.indent {
                    break
                }

                if Self.indentation(of: line) <= first.indent,
                   Self.fence(in: trimmed) != nil || Self.heading(in: trimmed) != nil || trimmed.hasPrefix(">") {
                    break
                }

                itemLines.append(String(line.dropFirst(min(marker.contentIndent, Self.indentation(of: line)))))
                index += 1
            }

            var checked: Bool?
            if let firstLine = itemLines.first {
                if firstLine.hasPrefix("[ ] ") {
                    checked = false
                    itemLines[0] = String(firstLine.dropFirst(4))
                } else if firstLine.lowercased().hasPrefix("[x] ") {
                    checked = true
                    itemLines[0] = String(firstLine.dropFirst(4))
                }
            }

            var nested = MarkdownBlockParser(lines: itemLines)
            items.append(MarkdownListItem(checked: checked, blocks: nested.parse()))

            if index < lines.count, lines[index].trimmingCharacters(in: .whitespaces).isEmpty,
               index + 1 < lines.count, let next = Self.listMarker(in: lines[index + 1]),
               next.ordered == first.ordered, next.indent == first.indent {
                index += 1
            }
        }

        return .list(ordered: first.ordered, start: first.number, items: items)
    }

    private mutating func parseTable() -> MarkdownTable? {
        guard index + 1 < lines.count,
              Self.isTableRow(lines[index]),
              let alignments = Self.tableAlignments(lines[index + 1]) else {
            return nil
        }

        let headers = Self.cells(from: lines[index])
        guard headers.count == alignments.count else {
            return nil
        }

        index += 2
        var rows: [[String]] = []
        while index < lines.count, Self.isTableRow(lines[index]) {
            rows.append(Self.cells(from: lines[index]))
            index += 1
        }

        return MarkdownTable(headers: headers, alignments: alignments, rows: rows)
    }

    private mutating func parseParagraph() -> MarkdownBlock {
        var paragraph: [String] = []

        while index < lines.count {
            let line = lines[index]
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            if trimmed.isEmpty {
                break
            }

            if !paragraph.isEmpty,
               Self.fence(in: trimmed) != nil || Self.heading(in: trimmed) != nil || Self.isRule(trimmed)
                || trimmed.hasPrefix(">") || Self.listMarker(in: line) != nil
                || (Self.isTableRow(line) && index + 1 < lines.count && Self.tableAlignments(lines[index + 1]) != nil) {
                break
            }

            paragraph.append(trimmed)
            index += 1
        }

        return .paragraph(paragraph.joined(separator: "\n"))
    }

    private static func indentation(of line: String) -> Int {
        var count = 0
        for character in line {
            if character == " " {
                count += 1
            } else if character == "\t" {
                count += 4
            } else {
                break
            }
        }
        return count
    }

    private static func fence(in trimmed: String) -> (marker: String, language: String?)? {
        for marker in ["```", "~~~"] where trimmed.hasPrefix(marker) {
            let language = trimmed.dropFirst(3).trimmingCharacters(in: .whitespaces)
            return (marker, language.isEmpty ? nil : language)
        }
        return nil
    }

    private static func heading(in trimmed: String) -> MarkdownBlock? {
        let hashes = trimmed.prefix { $0 == "#" }.count
        guard (1...6).contains(hashes) else {
            return nil
        }

        let rest = trimmed.dropFirst(hashes)
        guard rest.isEmpty || rest.first == " " else {
            return nil
        }

        var text = rest.trimmingCharacters(in: .whitespaces)
        while text.hasSuffix("#") {
            text.removeLast()
        }
        return .heading(level: hashes, text: text.trimmingCharacters(in: .whitespaces))
    }

    private static func isRule(_ trimmed: String) -> Bool {
        let compact = trimmed.replacingOccurrences(of: " ", with: "")
        guard compact.count >= 3, let first = compact.first, "-*_".contains(first) else {
            return false
        }
        return compact.allSatisfy { $0 == first }
    }

    private static func listMarker(in line: String) -> (ordered: Bool, number: Int, indent: Int, contentIndent: Int, content: String)? {
        let indent = indentation(of: line)
        let trimmed = line.drop { $0 == " " || $0 == "\t" }

        if let first = trimmed.first, "-*+".contains(first), trimmed.dropFirst().first == " " {
            if isRule(String(trimmed)) {
                return nil
            }
            return (false, 1, indent, indent + 2, String(trimmed.dropFirst(2)))
        }

        let digits = trimmed.prefix { $0.isNumber }
        guard !digits.isEmpty, digits.count <= 9 else {
            return nil
        }

        let afterDigits = trimmed.dropFirst(digits.count)
        guard let delimiter = afterDigits.first, delimiter == "." || delimiter == ")",
              afterDigits.dropFirst().first == " " else {
            return nil
        }

        return (true, Int(digits) ?? 1, indent, indent + digits.count + 2, String(afterDigits.dropFirst(2)))
    }

    private static func isTableRow(_ line: String) -> Bool {
        line.contains("|") && cells(from: line).count > 1
    }

    private static func tableAlignments(_ line: String) -> [MarkdownTable.Alignment]? {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        guard trimmed.contains("|") || trimmed.contains("-") else {
            return nil
        }

        let columns = cells(from: trimmed)
        guard !columns.isEmpty else {
            return nil
        }

        var alignments: [MarkdownTable.Alignment] = []
        for column in columns {
            let dashes = column.replacingOccurrences(of: ":", with: "")
            guard dashes.count >= 1, dashes.allSatisfy({ $0 == "-" }) else {
                return nil
            }
            switch (column.hasPrefix(":"), column.hasSuffix(":")) {
            case (true, true): alignments.append(.center)
            case (false, true): alignments.append(.trailing)
            default: alignments.append(.leading)
            }
        }
        return alignments
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
        guard isStreaming || isLikelyIncomplete(markdown) else {
            return markdown
        }

        return completeMarkdownTags(markdown).replacingOccurrences(of: "<[^>]*$", with: "", options: .regularExpression)
    }

    private static func completeMarkdownTags(_ markdown: String) -> String {
        var content = markdown

        if content.components(separatedBy: "```").count % 2 == 0 {
            content += "\n```"
        }

        let inlineCodeCount = content.replacingOccurrences(of: "```", with: "").filter { $0 == "`" }.count
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

        return content
    }

    private static func isLikelyIncomplete(_ markdown: String) -> Bool {
        let trimmed = markdown.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }

        let codeFenceCount = trimmed.components(separatedBy: "```").count - 1
        let boldCount = trimmed.components(separatedBy: "**").count - 1
        let inlineCodeCount = trimmed.replacingOccurrences(of: "```", with: "").filter { $0 == "`" }.count
        let openBrackets = trimmed.filter { $0 == "[" }.count
        let closeBrackets = trimmed.filter { $0 == "]" }.count

        return codeFenceCount % 2 == 1 ||
            boldCount % 2 == 1 ||
            inlineCodeCount % 2 == 1 ||
            (openBrackets > closeBrackets && trimmed.range(of: "\\[[^\\]]+$", options: .regularExpression) != nil) ||
            trimmed.range(of: "<[a-zA-Z][^>]*$", options: .regularExpression) != nil
    }
}

enum MarkdownInline {
    static func attributed(_ markdown: String) -> AttributedString {
        let options = AttributedString.MarkdownParsingOptions(
            allowsExtendedAttributes: true,
            interpretedSyntax: .inlineOnlyPreservingWhitespace,
            failurePolicy: .returnPartiallyParsedIfPossible
        )
        return (try? AttributedString(markdown: markdown, options: options)) ?? AttributedString(markdown)
    }
}

extension Array where Element == String {
    func value(at index: Int) -> String {
        indices.contains(index) ? self[index] : ""
    }
}
