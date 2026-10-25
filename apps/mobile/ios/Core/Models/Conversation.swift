import Foundation

struct Conversation: Identifiable, Equatable {
    let id: String
    var title: String
    var messages: [ChatMessage]
    let createdAt: Date
    var modelId: String?
    var modelTier: String? = nil
    var isLoadedFromAPI: Bool
    var lastMessageAt: Date?
    var messageCount: Int
    var latestResponse: PlatformResponse? = nil
    var hasMoreMessages = false
    var oldestMessageId: String? = nil
    var isTemporary: Bool = false
    var projectId: String? = nil
    var subject: ConversationSubject? = nil
    var isPinned = false
    var isUnread = false
}

public struct ConversationSubject: Encodable, Equatable {
    public let type: String
    public let id: String

    public init(type: String, id: String) {
        self.type = type
        self.id = id
    }
}
