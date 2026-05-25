import Foundation

struct ChatRequestMessage: Encodable {
    let id: String?
    let role: String
    let content: ChatRequestContent
    let data: ChatMessageData?
    let name: String?
    let parts: [ChatMessagePart]?

    init(message: ChatMessage) {
        self.id = message.id
        self.role = message.role
        self.content = ChatRequestContent(message: message)
        self.data = message.data
        self.name = message.name
        self.parts = message.parts
    }

    enum CodingKeys: String, CodingKey {
        case id, role, content, data, name, parts
    }
}

enum ChatRequestContent: Encodable {
    case text(String)
    case blocks([MessageContentBlock])

    init(message: ChatMessage) {
        switch message.content {
        case .text(let text):
            self = .text(text)
        case .multimodal(let blocks):
            let requestBlocks = blocks.compactMap(Self.requestBlock)
            if requestBlocks.isEmpty {
                self = .text(message.textContent)
            } else if message.role != "user", requestBlocks.allSatisfy(\.isTextBlock) {
                self = .text(requestBlocks.textContent.trimmingCharacters(in: .whitespacesAndNewlines))
            } else {
                self = .blocks(requestBlocks)
            }
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .text(let text):
            try container.encode(text)
        case .blocks(let blocks):
            try container.encode(blocks)
        }
    }

    private static func requestBlock(_ block: MessageContentBlock) -> MessageContentBlock? {
        switch block {
        case .text:
            return block
        case .imageUrl:
            return block
        case .inputAudio:
            return block
        case .documentUrl:
            return block
        case .markdownDocument:
            return block
        case .audioUrl, .artifact, .thinking:
            return nil
        }
    }
}

private extension MessageContentBlock {
    var isTextBlock: Bool {
        if case .text = self {
            return true
        }
        return false
    }
}
