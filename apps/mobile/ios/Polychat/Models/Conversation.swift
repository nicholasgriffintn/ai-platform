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
    /// Locked conversations are encrypted on the web app. iOS can list them but not read them.
    var isLocked: Bool = false

    static func == (lhs: Conversation, rhs: Conversation) -> Bool {
        lhs.id == rhs.id
    }
}
