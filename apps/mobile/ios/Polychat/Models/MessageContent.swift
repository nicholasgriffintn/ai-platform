import Foundation
public enum MessageContent: Codable, Equatable {
    case text(String)
    case multimodal([MessageContentBlock])

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .text(let string):
            try container.encode(string)
        case .multimodal(let blocks):
            try container.encode(blocks)
        }
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let string = try? container.decode(String.self) {
            self = .text(string)
        } else if let blocks = try? container.decode([MessageContentBlock].self) {
            self = .multimodal(blocks)
        } else {
            self = .text("")
        }
    }

    public var textValue: String {
        switch self {
        case .text(let string):
            return string
        case .multimodal(let blocks):
            return blocks.compactMap { block in
                if case .text(let text) = block {
                    return text.text
                }
                return nil
            }.joined(separator: "\n")
        }
    }
}

public enum MessageContentBlock: Codable, Equatable {
    case text(TextBlock)
    case imageUrl(ImageUrlBlock)
    case audioUrl(AudioUrlBlock)
    case inputAudio(InputAudioBlock)
    case documentUrl(DocumentUrlBlock)
    case markdownDocument(MarkdownDocumentBlock)
    case artifact(ArtifactBlock)
    case thinking(ThinkingBlock)

    public struct TextBlock: Codable, Equatable {
		public var type: String = "text"
        public let text: String

        public init(text: String) {
            self.text = text
        }
    }

    public struct ImageUrlBlock: Codable, Equatable {
        public let type: String = "image_url"
        public let imageUrl: ImageUrl

        public struct ImageUrl: Codable, Equatable {
            public let url: String
            public let detail: String?

            public init(url: String, detail: String? = "auto") {
                self.url = url
                self.detail = detail
            }
        }

        enum CodingKeys: String, CodingKey {
            case type
            case imageUrl = "image_url"
        }

        public init(url: String, detail: String? = "auto") {
            self.imageUrl = ImageUrl(url: url, detail: detail)
        }
    }

    public struct AudioUrlBlock: Codable, Equatable {
        public let type: String = "audio_url"
        public let audioUrl: AudioUrl

        public struct AudioUrl: Codable, Equatable {
            public let url: String
        }

        enum CodingKeys: String, CodingKey {
            case type
            case audioUrl = "audio_url"
        }

        public init(url: String) {
            self.audioUrl = AudioUrl(url: url)
        }
    }

    public struct InputAudioBlock: Codable, Equatable {
        public let type: String = "input_audio"
        public let inputAudio: InputAudio

        public struct InputAudio: Codable, Equatable {
            public let data: String
            public let format: String?
        }

        enum CodingKeys: String, CodingKey {
            case type
            case inputAudio = "input_audio"
        }

        public init(data: String, format: String? = nil) {
            self.inputAudio = InputAudio(data: data, format: format)
        }
    }

    public struct DocumentUrlBlock: Codable, Equatable {
        public let type: String = "document_url"
        public let documentUrl: DocumentUrl

        public struct DocumentUrl: Codable, Equatable {
            public let url: String
            public let name: String?
        }

        enum CodingKeys: String, CodingKey {
            case type
            case documentUrl = "document_url"
        }

        public init(url: String, name: String? = nil) {
            self.documentUrl = DocumentUrl(url: url, name: name)
        }
    }

    public struct MarkdownDocumentBlock: Codable, Equatable {
        public let type: String = "markdown_document"
        public let markdownDocument: MarkdownDocument

        public struct MarkdownDocument: Codable, Equatable {
            public let markdown: String
            public let name: String?
        }

        enum CodingKeys: String, CodingKey {
            case type
            case markdownDocument = "markdown_document"
        }

        public init(markdown: String, name: String? = nil) {
            self.markdownDocument = MarkdownDocument(markdown: markdown, name: name)
        }
    }

    public struct ArtifactBlock: Codable, Equatable {
        public var type: String = "artifact"
        public let artifact: InlineArtifact

        public struct InlineArtifact: Codable, Equatable {
            public let identifier: String
            public let type: String
            public let language: String?
            public let title: String?
            public let content: String
        }
    }

    public struct ThinkingBlock: Codable, Equatable {
        public var type: String = "thinking"
        public let thinking: String
        public let signature: String?
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .text(let block):
            try container.encode(block)
        case .imageUrl(let block):
            try container.encode(block)
        case .audioUrl(let block):
            try container.encode(block)
        case .inputAudio(let block):
            try container.encode(block)
        case .documentUrl(let block):
            try container.encode(block)
        case .markdownDocument(let block):
            try container.encode(block)
        case .artifact(let block):
            try container.encode(block)
        case .thinking(let block):
            try container.encode(block)
        }
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let textBlock = try? container.decode(TextBlock.self) {
            self = .text(textBlock)
        } else if let imageBlock = try? container.decode(ImageUrlBlock.self) {
            self = .imageUrl(imageBlock)
        } else if let audioUrlBlock = try? container.decode(AudioUrlBlock.self) {
            self = .audioUrl(audioUrlBlock)
        } else if let audioBlock = try? container.decode(InputAudioBlock.self) {
            self = .inputAudio(audioBlock)
        } else if let documentBlock = try? container.decode(DocumentUrlBlock.self) {
            self = .documentUrl(documentBlock)
        } else if let markdownBlock = try? container.decode(MarkdownDocumentBlock.self) {
            self = .markdownDocument(markdownBlock)
        } else if let artifactBlock = try? container.decode(ArtifactBlock.self) {
            self = .artifact(artifactBlock)
        } else if let thinkingBlock = try? container.decode(ThinkingBlock.self) {
            self = .thinking(thinkingBlock)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unknown content block type")
        }
    }
}

extension Array where Element == MessageContentBlock {
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
