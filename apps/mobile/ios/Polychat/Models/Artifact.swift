import Foundation
public struct Artifact: Codable, Identifiable, Equatable {
    public let id: String
    public let type: ArtifactType
    public let title: String
    public let content: String
    public let language: String?
    public let url: String?

    public enum ArtifactType: String, Codable {
        case code
        case image
        case text
        case markdown
    }

    public init(id: String, type: ArtifactType, title: String, content: String, language: String? = nil, url: String? = nil) {
        self.id = id
        self.type = type
        self.title = title
        self.content = content
        self.language = language
        self.url = url
    }

    public init(inlineArtifact: MessageContentBlock.ArtifactBlock.InlineArtifact) {
        self.init(
            id: inlineArtifact.identifier,
            type: ArtifactType(webType: inlineArtifact.type, language: inlineArtifact.language),
            title: inlineArtifact.title ?? "Artifact",
            content: inlineArtifact.content,
            language: inlineArtifact.language ?? inlineArtifact.type
        )
    }
}

extension Artifact.ArtifactType {
    init(webType: String, language: String?) {
        let lowerType = webType.lowercased()
        let lowerLanguage = language?.lowercased() ?? ""
        if lowerType.contains("image") {
            self = .image
        } else if lowerType.contains("markdown") || lowerLanguage == "markdown" || lowerLanguage == "md" {
            self = .markdown
        } else if lowerType.contains("code") ||
                    lowerType.contains("javascript") ||
                    lowerType.contains("html") ||
                    lowerType.contains("svg") ||
                    ["jsx", "javascript", "typescript", "html", "svg", "css", "swift", "python", "json"].contains(where: { lowerLanguage.contains($0) }) {
            self = .code
        } else {
            self = .text
        }
    }
}
