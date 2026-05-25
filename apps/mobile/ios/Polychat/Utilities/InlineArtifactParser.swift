import Foundation

struct InlineArtifactMatch {
    let artifact: Artifact
    let range: NSRange
}

enum InlineArtifactParser {
    static func artifacts(in text: String) -> [Artifact] {
        matches(in: text).map(\.artifact)
    }

    static func replacingArtifacts(
        in text: String,
        with replacement: (Artifact) -> String
    ) -> String {
        var result = text
        for match in matches(in: text).reversed() {
            result = (result as NSString).replacingCharacters(in: match.range, with: replacement(match.artifact))
        }
        return result
    }

    static func matches(in text: String) -> [InlineArtifactMatch] {
        let pattern = "<artifact\\s+([^>]*)>([\\s\\S]*?)(</artifact>|$)"
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return []
        }

        let nsText = text as NSString
        return regex.matches(in: text, range: NSRange(location: 0, length: nsText.length)).compactMap { match in
            guard match.numberOfRanges >= 3 else {
                return nil
            }

            let attributes = nsText.substring(with: match.range(at: 1))
            guard let identifier = XMLAttributeReader.value(named: "identifier", in: attributes),
                  !identifier.isEmpty else {
                return nil
            }

            let type = XMLAttributeReader.value(named: "type", in: attributes) ?? "text"
            let language = XMLAttributeReader.value(named: "language", in: attributes) ?? type
            let title = XMLAttributeReader.value(named: "title", in: attributes) ?? "Artifact"
            let content = nsText.substring(with: match.range(at: 2)).trimmingCharacters(in: .whitespacesAndNewlines)

            return InlineArtifactMatch(
                artifact: Artifact(
                    id: identifier,
                    type: Artifact.ArtifactType(webType: type, language: language),
                    title: title,
                    content: content,
                    language: language
                ),
                range: match.range
            )
        }
    }
}
