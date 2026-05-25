import Foundation

struct Conversation: Identifiable, Equatable {
    let id: String
    var title: String
    var messages: [ChatMessage]
    let createdAt: Date
    var modelId: String?
    var isLoadedFromAPI: Bool
    var lastMessageAt: Date?
    var messageCount: Int

    static func == (lhs: Conversation, rhs: Conversation) -> Bool {
        lhs.id == rhs.id
    }
}
