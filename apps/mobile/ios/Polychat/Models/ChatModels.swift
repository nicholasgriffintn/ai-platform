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

public struct ChatReasoning: Codable, Equatable {
    public let collapsed: Bool
    public let content: String
}

public struct ChatCitation: Codable, Equatable {
    public let url: String
    public let title: String?

    public init(url: String, title: String? = nil) {
        self.url = url
        self.title = title
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let string = try? container.decode(String.self) {
            url = string
            title = nil
            return
        }

        let object = try decoder.container(keyedBy: CodingKeys.self)
        url = try object.decode(String.self, forKey: .url)
        title = try object.decodeIfPresent(String.self, forKey: .title)
    }
}

public struct ChatMessagePart: Codable, Equatable, Identifiable {
    public var id: String { explicitId ?? "\(type)-\(timestamp ?? 0)-\(text ?? name ?? url ?? summary ?? "")" }
    public let explicitId: String?
    public let type: String
    public let text: String?
    public let name: String?
    public let toolCallId: String?
    public let input: JSONValue?
    public let status: String?
    public let content: JSONValue?
    public let data: JSONValue?
    public let title: String?
    public let summary: String?
    public let url: String?
    public let mimeType: String?
    public let collapsed: Bool?
    public let timestamp: Double?

    enum CodingKeys: String, CodingKey {
        case explicitId = "id"
        case type, text, name, input, status, content, data, title, summary, url, mimeType, collapsed, timestamp
        case toolCallId
        case toolCallIdSnake = "tool_call_id"
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        explicitId = try container.decodeIfPresent(String.self, forKey: .explicitId)
        type = try container.decode(String.self, forKey: .type)
        text = try container.decodeIfPresent(String.self, forKey: .text)
        name = try container.decodeIfPresent(String.self, forKey: .name)
        toolCallId = try container.decodeIfPresent(String.self, forKey: .toolCallId)
            ?? container.decodeIfPresent(String.self, forKey: .toolCallIdSnake)
        input = try container.decodeIfPresent(JSONValue.self, forKey: .input)
        status = try container.decodeIfPresent(String.self, forKey: .status)
        content = try container.decodeIfPresent(JSONValue.self, forKey: .content)
        data = try container.decodeIfPresent(JSONValue.self, forKey: .data)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        summary = try container.decodeIfPresent(String.self, forKey: .summary)
        url = try container.decodeIfPresent(String.self, forKey: .url)
        mimeType = try container.decodeIfPresent(String.self, forKey: .mimeType)
        collapsed = try container.decodeIfPresent(Bool.self, forKey: .collapsed)
        timestamp = try container.decodeIfPresent(Double.self, forKey: .timestamp)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(explicitId, forKey: .explicitId)
        try container.encode(type, forKey: .type)
        try container.encodeIfPresent(text, forKey: .text)
        try container.encodeIfPresent(name, forKey: .name)
        try container.encodeIfPresent(toolCallId, forKey: .toolCallId)
        try container.encodeIfPresent(input, forKey: .input)
        try container.encodeIfPresent(status, forKey: .status)
        try container.encodeIfPresent(content, forKey: .content)
        try container.encodeIfPresent(data, forKey: .data)
        try container.encodeIfPresent(title, forKey: .title)
        try container.encodeIfPresent(summary, forKey: .summary)
        try container.encodeIfPresent(url, forKey: .url)
        try container.encodeIfPresent(mimeType, forKey: .mimeType)
        try container.encodeIfPresent(collapsed, forKey: .collapsed)
        try container.encodeIfPresent(timestamp, forKey: .timestamp)
    }
}

public struct ChatMessageData: Codable, Equatable {
    public let formattedName: String?
    public let responseType: String?
    public let responseDisplay: JSONValue?
    public let attachments: [ChatAttachment]?
    public let searchGrounding: SearchGrounding?
    public let asyncInvocation: AsyncInvocation?
    public let council: CouncilMetadata?
    public let error: String?

    public struct ChatAttachment: Codable, Equatable, Identifiable {
        public var id: String { url }
        public let type: String
        public let url: String
        public let detail: String?
        public let name: String?
        public let isMarkdown: Bool?
    }

    public struct SearchGrounding: Codable, Equatable {
        public let groundingChunks: [GroundingChunk]?
        public let webSearchQueries: [String]?

        public struct GroundingChunk: Codable, Equatable {
            public let web: WebSource?
        }

        public struct WebSource: Codable, Equatable {
            public let uri: String
            public let title: String?
        }
    }

    public struct AsyncInvocation: Codable, Equatable {
        public let status: String?
        public let contentHints: ContentHints?

        public struct ContentHints: Codable, Equatable {
            public let placeholder: [MessageContentBlock]?
            public let progress: [MessageContentBlock]?
            public let failure: [MessageContentBlock]?
        }
    }

    public struct CouncilMetadata: Codable, Equatable {
        public let memberName: String?
        public let memberRole: String?
        public let round: Int?
        public let turn: Int?
    }
}

public enum JSONValue: Codable, Equatable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else {
            self = .object(try container.decode([String: JSONValue].self))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value):
            try container.encode(value)
        case .number(let value):
            try container.encode(value)
        case .bool(let value):
            try container.encode(value)
        case .object(let value):
            try container.encode(value)
        case .array(let value):
            try container.encode(value)
        case .null:
            try container.encodeNil()
        }
    }

    public var stringValue: String? {
        if case .string(let value) = self {
            return value
        }
        return nil
    }

    public var prettyString: String {
        switch self {
        case .string(let value):
            return value
        case .number(let value):
            return String(value)
        case .bool(let value):
            return String(value)
        case .null:
            return "null"
        case .object, .array:
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            if let data = try? encoder.encode(self), let string = String(data: data, encoding: .utf8) {
                return string
            }
            return ""
        }
    }
}

public struct ChatMessage: Codable, Identifiable, Equatable {
    public static func == (lhs: ChatMessage, rhs: ChatMessage) -> Bool {
        lhs.id == rhs.id
    }

    public let id: String
    public let role: String
    public let content: MessageContent
    public var artifacts: [Artifact]?
    public let model: String?
    public let parts: [ChatMessagePart]?
    public let reasoning: ChatReasoning?
    public let citations: [ChatCitation]?
    public let data: ChatMessageData?
    public let name: String?
    public let status: String?
    public let logId: String?
    public let created: Double?
    public let timestamp: Double?

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(role, forKey: .role)
        try container.encode(content, forKey: .content)
    }

    public var isFromCurrentUser: Bool {
        role == "user"
    }

    public var textContent: String {
        content.textValue
    }

    public init(
        id: String = UUID().uuidString,
        role: String,
        content: String,
        artifacts: [Artifact]? = nil,
        model: String? = nil,
        parts: [ChatMessagePart]? = nil,
        reasoning: ChatReasoning? = nil,
        citations: [ChatCitation]? = nil,
        data: ChatMessageData? = nil,
        name: String? = nil,
        status: String? = nil,
        logId: String? = nil,
        created: Double? = nil,
        timestamp: Double? = nil
    ) {
        self.id = id
        self.role = role
        self.content = .text(content)
        self.artifacts = artifacts
        self.model = model
        self.parts = parts
        self.reasoning = reasoning
        self.citations = citations
        self.data = data
        self.name = name
        self.status = status
        self.logId = logId
        self.created = created
        self.timestamp = timestamp
    }

    public init(
        id: String = UUID().uuidString,
        role: String,
        contentBlocks: [MessageContentBlock],
        artifacts: [Artifact]? = nil,
        model: String? = nil
    ) {
        self.id = id
        self.role = role
        self.content = .multimodal(contentBlocks)
        self.artifacts = artifacts
        self.model = model
        self.parts = nil
        self.reasoning = nil
        self.citations = nil
        self.data = nil
        self.name = nil
        self.status = nil
        self.logId = nil
        self.created = nil
        self.timestamp = nil
    }

    enum CodingKeys: String, CodingKey {
        case id, role, content, model, parts, reasoning, citations, data, name, status, created, timestamp
        case modelId = "model_id"
        case logId = "log_id"
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        role = try container.decode(String.self, forKey: .role)
        content = try container.decode(MessageContent.self, forKey: .content)
        id = (try? container.decode(String.self, forKey: .id)) ?? UUID().uuidString
        artifacts = nil
        model = try container.decodeIfPresent(String.self, forKey: .model)
            ?? container.decodeIfPresent(String.self, forKey: .modelId)
        parts = try container.decodeIfPresent([ChatMessagePart].self, forKey: .parts)
        reasoning = try container.decodeIfPresent(ChatReasoning.self, forKey: .reasoning)
        citations = try container.decodeIfPresent([ChatCitation].self, forKey: .citations)
        data = try container.decodeIfPresent(ChatMessageData.self, forKey: .data)
        name = try container.decodeIfPresent(String.self, forKey: .name)
        status = try container.decodeIfPresent(String.self, forKey: .status)
        logId = try container.decodeIfPresent(String.self, forKey: .logId)
        created = try container.decodeIfPresent(Double.self, forKey: .created)
        timestamp = try container.decodeIfPresent(Double.self, forKey: .timestamp)
    }

    public mutating func extractArtifacts() {
        var extractedArtifacts = inlineArtifacts
        let codeBlockPattern = "```(\\w*)\\n([\\s\\S]*?)```"
        guard let regex = try? NSRegularExpression(pattern: codeBlockPattern, options: []) else {
            return
        }

        let textContent = self.textContent
        let nsContent = textContent as NSString
        let matches = regex.matches(in: textContent, options: [], range: NSRange(location: 0, length: nsContent.length))

        for match in matches {
            let languageRange = match.range(at: 1)
            let codeRange = match.range(at: 2)

            let language = languageRange.location != NSNotFound ? nsContent.substring(with: languageRange) : "text"
            let code = codeRange.location != NSNotFound ? nsContent.substring(with: codeRange) : ""

            let artifact = Artifact(
                id: UUID().uuidString,
                type: .code,
                title: "\(language.isEmpty ? "Code" : language.capitalized) Block",
                content: code,
                language: language.isEmpty ? nil : language
            )
            extractedArtifacts.append(artifact)
        }

        if !extractedArtifacts.isEmpty {
            self.artifacts = extractedArtifacts
        }
    }

    private var inlineArtifacts: [Artifact] {
        var extracted: [Artifact] = []

        if case .multimodal(let blocks) = content {
            for block in blocks {
                if case .artifact(let artifactBlock) = block {
                    extracted.append(Artifact(inlineArtifact: artifactBlock.artifact))
                }
            }
        }

        let text = textContent
        guard let regex = try? NSRegularExpression(pattern: "<artifact\\s+([^>]*)>([\\s\\S]*?)(</artifact>|$)") else {
            return extracted
        }

        let nsText = text as NSString
        let matches = regex.matches(in: text, range: NSRange(location: 0, length: nsText.length))
        for match in matches where match.numberOfRanges >= 3 {
            let attributes = nsText.substring(with: match.range(at: 1))
            guard let identifier = Self.attribute("identifier", in: attributes), !identifier.isEmpty else {
                continue
            }
            let type = Self.attribute("type", in: attributes) ?? "text"
            let language = Self.attribute("language", in: attributes) ?? type
            let title = Self.attribute("title", in: attributes) ?? "Artifact"
            let content = nsText.substring(with: match.range(at: 2)).trimmingCharacters(in: .whitespacesAndNewlines)
            extracted.append(
                Artifact(
                    id: identifier,
                    type: Artifact.ArtifactType(webType: type, language: language),
                    title: title,
                    content: content,
                    language: language
                )
            )
        }

        return extracted
    }

    private static func attribute(_ name: String, in attributes: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: "\(name)=\"([^\"]*)\"", options: .caseInsensitive) else {
            return nil
        }

        let nsAttributes = attributes as NSString
        guard let match = regex.firstMatch(in: attributes, range: NSRange(location: 0, length: nsAttributes.length)),
              match.numberOfRanges >= 2 else {
            return nil
        }
        return nsAttributes.substring(with: match.range(at: 1))
    }
}

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

public struct ChatCompletionResponse: Codable {
    public let choices: [ChatChoice]

    public struct ChatChoice: Codable {
        public let message: ChatMessage
    }
}

public struct ChatCompletionRequest: Codable {
    let messages: [ChatMessage]
    let model: String?
    let provider: String?
    let platform: String
    let mode: String
    let store: Bool
    let stream: Bool
    let completionId: String?
    let options: [String: JSONValue]
    let temperature: Double?
    let topP: Double?
    let maxTokens: Int?
    let presencePenalty: Double?
    let frequencyPenalty: Double?
    let useRag: Bool?
    let ragOptions: RagOptions?
    let reasoning: ReasoningSettings?
    let reasoningEffort: String?
    let verbosity: String?
    let enabledTools: [String]?

    enum CodingKeys: String, CodingKey {
        case messages, model, provider, platform, mode, store, stream, temperature, reasoning, verbosity, options
        case completionId = "completion_id"
        case topP = "top_p"
        case maxTokens = "max_tokens"
        case presencePenalty = "presence_penalty"
        case frequencyPenalty = "frequency_penalty"
        case useRag = "use_rag"
        case ragOptions = "rag_options"
        case reasoningEffort = "reasoning_effort"
        case enabledTools = "enabled_tools"
    }

    public init(
        messages: [ChatMessage],
        model: String?,
        provider: String? = nil,
        store: Bool = true,
        completionId: String? = nil,
        settings: ChatSettings? = nil,
        stream: Bool = false
    ) {
        self.messages = messages
        self.model = model
        self.provider = provider
        self.platform = "mobile"
        self.mode = "remote"
        self.store = store
        self.stream = stream
        self.completionId = completionId
        self.options = settings?.toolOptions ?? [:]
        self.temperature = settings?.temperature
        self.topP = settings?.topP
        self.maxTokens = settings?.maxTokens
        self.presencePenalty = settings?.presencePenalty
        self.frequencyPenalty = settings?.frequencyPenalty
        self.useRag = settings?.useRag == true ? true : nil
        self.ragOptions = settings?.useRag == true ? settings?.ragOptions : nil
        self.reasoning = settings?.reasoningEffort.map { ReasoningSettings(effort: $0.rawValue) }
        self.reasoningEffort = settings?.reasoningEffort?.rawValue
        self.verbosity = settings?.verbosity?.rawValue
        self.enabledTools = settings?.enabledTools.isEmpty == false ? settings?.enabledTools : nil
    }
}

public struct ReasoningSettings: Codable, Equatable {
    public let effort: String
}

public struct RagOptions: Codable, Equatable {
    public var topK: Int
    public var scoreThreshold: Double
    public var includeMetadata: Bool
    public var namespace: String

    public static let `default` = RagOptions(
        topK: 3,
        scoreThreshold: 0.5,
        includeMetadata: false,
        namespace: ""
    )
}

public struct TranscriptionResponse: Codable {
    let response: FunctionResponse
}

public struct FunctionResponse: Codable {
    let status: String?
    let content: String
}

public struct UploadResponse: Codable {
    let url: String
    let type: String
    let name: String
    let markdown: String?
}

public struct ErrorResponse: Codable {
    let error: String
}

public struct ModelConfigItem: Codable, Identifiable {
    public var id: String = ""
    public let name: String?
    public let provider: String
    public let description: String?
    public let strengths: [String]?
    public let contextWindow: Int?
    public let pricing: ModelPricing?
    public let modalities: ModelModalities?
    public let supportsFunctions: Bool?
    public let multimodal: Bool?
    public let isFeatured: Bool?
    public let isDeprecated: Bool?
    
    public struct ModelPricing: Codable {
        public let costPer1kInputTokens: Double?
        public let costPer1kOutputTokens: Double?
    }
    
    public struct ModelModalities: Codable {
        public let input: [String]
        public let output: [String]?
    }
    
    enum CodingKeys: String, CodingKey {
        case name, provider, description, strengths, contextWindow, pricing, modalities, supportsFunctions, multimodal
        case isFeatured, featured
        case isDeprecated, deprecated
    }
    
    public init(
        id: String,
        name: String?,
        provider: String,
        description: String?,
        strengths: [String]?,
        contextWindow: Int?,
        pricing: ModelPricing?,
        modalities: ModelModalities?,
        supportsFunctions: Bool?,
        multimodal: Bool?,
        isFeatured: Bool? = nil,
        isDeprecated: Bool? = nil
    ) {
        self.id = id
        self.name = name
        self.provider = provider
        self.description = description
        self.strengths = strengths
        self.contextWindow = contextWindow
        self.pricing = pricing
        self.modalities = modalities
        self.supportsFunctions = supportsFunctions
        self.multimodal = multimodal
        self.isFeatured = isFeatured
        self.isDeprecated = isDeprecated
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        name = try container.decodeIfPresent(String.self, forKey: .name)
        provider = try container.decode(String.self, forKey: .provider)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        strengths = try container.decodeIfPresent([String].self, forKey: .strengths)
        contextWindow = try container.decodeIfPresent(Int.self, forKey: .contextWindow)
        pricing = try container.decodeIfPresent(ModelPricing.self, forKey: .pricing)
        modalities = try container.decodeIfPresent(ModelModalities.self, forKey: .modalities)
        supportsFunctions = try container.decodeIfPresent(Bool.self, forKey: .supportsFunctions)
        multimodal = try container.decodeIfPresent(Bool.self, forKey: .multimodal)
        isFeatured = try container.decodeIfPresent(Bool.self, forKey: .isFeatured)
            ?? container.decodeIfPresent(Bool.self, forKey: .featured)
        isDeprecated = try container.decodeIfPresent(Bool.self, forKey: .isDeprecated)
            ?? container.decodeIfPresent(Bool.self, forKey: .deprecated)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)

        try container.encodeIfPresent(name, forKey: .name)
        try container.encode(provider, forKey: .provider)
        try container.encodeIfPresent(description, forKey: .description)
        try container.encodeIfPresent(strengths, forKey: .strengths)
        try container.encodeIfPresent(contextWindow, forKey: .contextWindow)
        try container.encodeIfPresent(pricing, forKey: .pricing)
        try container.encodeIfPresent(modalities, forKey: .modalities)
        try container.encodeIfPresent(supportsFunctions, forKey: .supportsFunctions)
        try container.encodeIfPresent(multimodal, forKey: .multimodal)
        try container.encodeIfPresent(isFeatured, forKey: .isFeatured)
        try container.encodeIfPresent(isDeprecated, forKey: .isDeprecated)
    }
}

public typealias ModelsResponse = [String: ModelConfigItem]

public struct ToolDefinition: Codable, Identifiable, Equatable {
    public let id: String
    public let name: String
    public let description: String
    public let isDefault: Bool?
}

public struct TitleGenerationRequest: Codable {
    let messages: [ChatMessage]
}

public struct TitleGenerationResponse: Codable {
    public let title: String
}

public struct UpdateConversationRequest: Codable {
    let title: String
}

public struct UpdateConversationResponse: Codable {
    public let success: Bool
    public let message: String?
    public let data: ConversationData?

    public struct ConversationData: Codable {
        public let id: String
        public let title: String
        public let updatedAt: String
    }
}

public struct ConversationListResponse: Codable {
    public let conversations: [ConversationSummary]
    public let totalPages: Int
    public let pageNumber: Int
    public let pageSize: Int

    public struct ConversationSummary: Codable, Identifiable {
        public let id: String
        public let title: String?
        public let createdAt: String
        public let updatedAt: String
        public let model: String?
        public let isArchived: Bool
        public let userId: Int?
        public let shareId: String?
        public let messages: [String]
        public let lastMessageAt: String?
        public let messageCount: Int?

        enum CodingKeys: String, CodingKey {
            case id, title, model, messages
            case createdAt = "created_at"
            case updatedAt = "updated_at"
            case isArchived = "is_archived"
            case userId = "user_id"
            case shareId = "share_id"
            case lastMessageAt = "last_message_at"
            case messageCount = "message_count"
        }

        public init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            id = try container.decode(String.self, forKey: .id)
            title = try container.decodeIfPresent(String.self, forKey: .title)
            createdAt = try container.decode(String.self, forKey: .createdAt)
            updatedAt = try container.decode(String.self, forKey: .updatedAt)
            model = try container.decodeIfPresent(String.self, forKey: .model)
            isArchived = try container.decodeFlexibleBool(forKey: .isArchived)
            userId = try container.decodeFlexibleIntIfPresent(forKey: .userId)
            shareId = try container.decodeIfPresent(String.self, forKey: .shareId)
            messages = try container.decodeIfPresent([String].self, forKey: .messages) ?? []
            lastMessageAt = try container.decodeIfPresent(String.self, forKey: .lastMessageAt)
            messageCount = try container.decodeIfPresent(Int.self, forKey: .messageCount)
        }
    }
}

public struct ConversationDetailResponse: Codable {
    public let id: String
    public let title: String?
    public let createdAt: String
    public let updatedAt: String
    public let model: String?
    public let isArchived: Bool
    public let messages: [ChatMessage]
    public let shareId: String?
    public let lastMessageAt: String?
    public let messageCount: Int?

    enum CodingKeys: String, CodingKey {
        case id, title, model, messages
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case isArchived = "is_archived"
        case shareId = "share_id"
        case lastMessageAt = "last_message_at"
        case messageCount = "message_count"
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        createdAt = try container.decode(String.self, forKey: .createdAt)
        updatedAt = try container.decode(String.self, forKey: .updatedAt)
        model = try container.decodeIfPresent(String.self, forKey: .model)
        isArchived = try container.decodeFlexibleBool(forKey: .isArchived)
        messages = try container.decodeIfPresent([ChatMessage].self, forKey: .messages) ?? []
        shareId = try container.decodeIfPresent(String.self, forKey: .shareId)
        lastMessageAt = try container.decodeIfPresent(String.self, forKey: .lastMessageAt)
        messageCount = try container.decodeIfPresent(Int.self, forKey: .messageCount)
    }
}

public struct ChatSettings: Codable, Equatable {
    public var temperature: Double
    public var topP: Double
    public var maxTokens: Int?
    public var presencePenalty: Double
    public var frequencyPenalty: Double
    public var useRag: Bool
    public var ragOptions: RagOptions
    public var reasoningEffort: ReasoningEffort?
    public var verbosity: VerbosityLevel?
    public var enabledTools: [String]
    public var toolOptions: [String: JSONValue]

    public enum ReasoningEffort: String, Codable, CaseIterable {
        case none = "none"
        case simulatedThinking = "simulated-thinking"
        case thinking = "thinking"
        case low = "low"
        case medium = "medium"
        case high = "high"

        public var displayName: String {
            switch self {
            case .none:
                return "None"
            case .simulatedThinking:
                return "Thinking"
            case .thinking:
                return "Thinking"
            case .low:
                return "Low"
            case .medium:
                return "Medium"
            case .high:
                return "High"
            }
        }
    }

    public enum VerbosityLevel: String, Codable, CaseIterable {
        case low = "low"
        case medium = "medium"
        case high = "high"
        case caveman = "caveman"

        public var displayName: String {
            rawValue.capitalized
        }
    }

    public static let `default` = ChatSettings(
        temperature: 0.7,
        topP: 0.8,
        maxTokens: nil,
        presencePenalty: 0,
        frequencyPenalty: 0,
        useRag: false,
        ragOptions: .default,
        reasoningEffort: nil,
        verbosity: nil,
        enabledTools: [],
        toolOptions: [:]
    )

    public init(
        temperature: Double = 0.7,
        topP: Double = 0.8,
        maxTokens: Int? = nil,
        presencePenalty: Double = 0,
        frequencyPenalty: Double = 0,
        useRag: Bool = false,
        ragOptions: RagOptions = .default,
        reasoningEffort: ReasoningEffort? = nil,
        verbosity: VerbosityLevel? = nil,
        enabledTools: [String] = [],
        toolOptions: [String: JSONValue] = [:]
    ) {
        self.temperature = temperature
        self.topP = topP
        self.maxTokens = maxTokens
        self.presencePenalty = presencePenalty
        self.frequencyPenalty = frequencyPenalty
        self.useRag = useRag
        self.ragOptions = ragOptions
        self.reasoningEffort = reasoningEffort
        self.verbosity = verbosity
        self.enabledTools = enabledTools
        self.toolOptions = toolOptions
    }
}

public struct AuthUser: Codable, Equatable {
    public let id: Int
    public let name: String?
    public let avatarUrl: String?
    public let email: String
    public let githubUsername: String?
    public let planId: String?

    enum CodingKeys: String, CodingKey {
        case id, name, email
        case avatarUrl = "avatar_url"
        case githubUsername = "github_username"
        case planId = "plan_id"
    }
}

public struct AuthStatusResponse: Codable {
    public let user: AuthUser?
}

public struct TokenResponse: Codable {
    public let token: String
    public let expiresIn: Int
    public let tokenType: String?

    enum CodingKeys: String, CodingKey {
        case token
        case expiresIn = "expires_in"
        case tokenType = "token_type"
    }
}

public struct MagicLinkRequest: Codable {
    public let email: String
    public let redirectUri: String

    enum CodingKeys: String, CodingKey {
        case email
        case redirectUri = "redirect_uri"
    }
}

public struct MagicLinkVerifyRequest: Codable {
    public let token: String
    public let nonce: String
}

public struct MobileAuthExchangeRequest: Codable {
    public let code: String
}

public struct AppleSignInRequest: Codable {
    public let identityToken: String
    public let nonce: String
    public let fullName: String?

    enum CodingKeys: String, CodingKey {
        case identityToken = "identity_token"
        case nonce
        case fullName = "full_name"
    }
}

public struct SuccessResponse: Codable {
    public let success: Bool
}

private extension KeyedDecodingContainer {
    func decodeFlexibleBool(forKey key: Key) throws -> Bool {
        if let value = try? decode(Bool.self, forKey: key) {
            return value
        }
        if let value = try? decode(Int.self, forKey: key) {
            return value != 0
        }
        if let value = try? decode(String.self, forKey: key) {
            return value == "true" || value == "1"
        }
        return false
    }

    func decodeFlexibleIntIfPresent(forKey key: Key) throws -> Int? {
        if let value = try? decodeIfPresent(Int.self, forKey: key) {
            return value
        }
        if let value = try? decodeIfPresent(String.self, forKey: key) {
            return Int(value)
        }
        return nil
    }
}
