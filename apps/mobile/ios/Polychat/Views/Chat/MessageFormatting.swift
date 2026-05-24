import Foundation

enum MessageContentSegment {
    case text(String)
    case artifact(Artifact)
}

struct FormattedMessageContent {
    struct ReasoningItem {
        let content: String
        let isOpen: Bool
    }

    let segments: [MessageContentSegment]
    let reasoning: [ReasoningItem]
    let artifacts: [Artifact]
}

enum MessageFormatting {
    static func formattedMessageContent(role: String, originalContent: String) -> FormattedMessageContent {
        var content = originalContent
        var reasoning: [FormattedMessageContent.ReasoningItem] = []
        var artifacts: [Artifact] = []

        extractReasoning(tag: "think", from: &content, into: &reasoning)
        extractReasoning(tag: "analysis", from: &content, into: &reasoning)

        if role == "assistant" {
            artifacts = extractArtifacts(from: content)
            for artifact in artifacts {
                let pattern = "<artifact[^>]*identifier=\"\(NSRegularExpression.escapedPattern(for: artifact.id))\"[^>]*>[\\s\\S]*?(?:</artifact>|$)"
                content = content.replacingOccurrences(
                    of: pattern,
                    with: "[[ARTIFACT:\(artifact.id)]]",
                    options: .regularExpression
                )
            }
        }

        content = unwrapTag("answer", in: content).trimmingCharacters(in: .whitespacesAndNewlines)
        let segments = splitContentByArtifacts(content: content, artifacts: artifacts)
        return FormattedMessageContent(segments: segments, reasoning: reasoning, artifacts: artifacts)
    }

    static func processCustomXmlTags(_ text: String) -> String {
        let fencePattern = "```[\\s\\S]*?```"
        guard let fenceRegex = try? NSRegularExpression(pattern: fencePattern) else {
            return text
        }

        let nsText = text as NSString
        let matches = fenceRegex.matches(in: text, range: NSRange(location: 0, length: nsText.length))
        var protected = text
        var fences: [String] = []

        for match in matches.reversed() {
            let fence = nsText.substring(with: match.range)
            fences.insert(fence, at: 0)
            protected = (protected as NSString).replacingCharacters(in: match.range, with: "<<CODE_BLOCK_\(fences.count - 1)>>")
        }

        let tagPattern = "<([A-Za-z][\\w-]*)\\b[^>]*>([\\s\\S]*?)</\\1>"
        guard let tagRegex = try? NSRegularExpression(pattern: tagPattern) else {
            return text
        }

        let nsProtected = protected as NSString
        var processed = protected
        let tagMatches = tagRegex.matches(in: protected, range: NSRange(location: 0, length: nsProtected.length))
        for match in tagMatches.reversed() where match.numberOfRanges >= 3 {
            let tagName = nsProtected.substring(with: match.range(at: 1))
            let inner = nsProtected.substring(with: match.range(at: 2))
            let title = tagName
                .split { $0 == "_" || $0 == "-" }
                .map { $0.prefix(1).uppercased() + $0.dropFirst().lowercased() }
                .joined(separator: " ")
            processed = (processed as NSString).replacingCharacters(in: match.range, with: "**\(title)**\n\n\(inner)\n\n")
        }

        for (index, fence) in fences.enumerated() {
            processed = processed.replacingOccurrences(of: "<<CODE_BLOCK_\(index)>>", with: fence)
        }

        return processed
    }

    private static func extractReasoning(
        tag: String,
        from content: inout String,
        into reasoning: inout [FormattedMessageContent.ReasoningItem]
    ) {
        let pattern = "<\(tag)>([\\s\\S]*?)(</\(tag)>|$)"
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return
        }

        let nsContent = content as NSString
        let matches = regex.matches(in: content, range: NSRange(location: 0, length: nsContent.length))
        for match in matches.reversed() where match.numberOfRanges >= 2 {
            let full = nsContent.substring(with: match.range)
            let value = nsContent.substring(with: match.range(at: 1)).trimmingCharacters(in: .whitespacesAndNewlines)
            reasoning.insert(FormattedMessageContent.ReasoningItem(content: value, isOpen: !full.contains("</\(tag)>")), at: 0)
            content = (content as NSString).replacingCharacters(in: match.range, with: "")
        }
    }

    private static func extractArtifacts(from content: String) -> [Artifact] {
        let pattern = "<artifact\\s+([^>]*)>([\\s\\S]*?)(</artifact>|$)"
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return []
        }

        let nsContent = content as NSString
        return regex.matches(in: content, range: NSRange(location: 0, length: nsContent.length)).compactMap { match in
            guard match.numberOfRanges >= 3 else { return nil }
            let attributes = nsContent.substring(with: match.range(at: 1))
            guard let identifier = attribute("identifier", in: attributes), !identifier.isEmpty else {
                return nil
            }

            let type = attribute("type", in: attributes) ?? "text"
            let language = attribute("language", in: attributes) ?? type
            let title = attribute("title", in: attributes) ?? "Artifact"
            let artifactContent = nsContent.substring(with: match.range(at: 2)).trimmingCharacters(in: .whitespacesAndNewlines)
            return Artifact(id: identifier, type: Artifact.ArtifactType(webType: type, language: language), title: title, content: artifactContent, language: language)
        }
    }

    private static func attribute(_ name: String, in attributes: String) -> String? {
        let pattern = "\(name)=\"([^\"]*)\""
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else {
            return nil
        }

        let nsAttributes = attributes as NSString
        guard let match = regex.firstMatch(in: attributes, range: NSRange(location: 0, length: nsAttributes.length)),
              match.numberOfRanges >= 2 else {
            return nil
        }
        return nsAttributes.substring(with: match.range(at: 1))
    }

    private static func unwrapTag(_ tag: String, in content: String) -> String {
        let pattern = "<\(tag)>([\\s\\S]*?)(</\(tag)>|$)"
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return content.replacingOccurrences(of: "<\(tag)>", with: "").replacingOccurrences(of: "</\(tag)>", with: "")
        }

        let nsContent = content as NSString
        var result = content
        let matches = regex.matches(in: content, range: NSRange(location: 0, length: nsContent.length))
        for match in matches.reversed() where match.numberOfRanges >= 2 {
            let inner = nsContent.substring(with: match.range(at: 1))
            result = (result as NSString).replacingCharacters(in: match.range, with: inner)
        }
        return result.replacingOccurrences(of: "<\(tag)>", with: "").replacingOccurrences(of: "</\(tag)>", with: "")
    }

    private static func splitContentByArtifacts(content: String, artifacts: [Artifact]) -> [MessageContentSegment] {
        guard !artifacts.isEmpty,
              let regex = try? NSRegularExpression(pattern: "\\[\\[ARTIFACT:([^\\]]+)\\]\\]") else {
            return [.text(content)]
        }

        let artifactMap = Dictionary(uniqueKeysWithValues: artifacts.map { ($0.id, $0) })
        let nsContent = content as NSString
        let matches = regex.matches(in: content, range: NSRange(location: 0, length: nsContent.length))
        var segments: [MessageContentSegment] = []
        var location = 0

        for match in matches {
            if match.range.location > location {
                segments.append(.text(nsContent.substring(with: NSRange(location: location, length: match.range.location - location))))
            }

            let identifier = nsContent.substring(with: match.range(at: 1))
            if let artifact = artifactMap[identifier] {
                segments.append(.artifact(artifact))
            } else {
                segments.append(.text("[[ARTIFACT:\(identifier)]]"))
            }

            location = match.range.location + match.range.length
        }

        if location < nsContent.length {
            segments.append(.text(nsContent.substring(from: location)))
        }

        return segments.isEmpty ? [.text(content)] : segments
    }
}
