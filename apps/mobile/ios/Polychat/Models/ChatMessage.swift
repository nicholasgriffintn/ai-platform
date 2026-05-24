import Foundation
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
