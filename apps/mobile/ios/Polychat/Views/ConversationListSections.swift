import Foundation

struct ConversationListSection: Identifiable {
    let id: String
    let title: String
    let conversations: [Conversation]
}

enum ConversationListSectionBuilder {
    private static let orderedTitles = [
        "Today",
        "Yesterday",
        "This Week",
        "This Month",
        "Older"
    ]

    static func sections(
        for conversations: [Conversation],
        calendar: Calendar = .current,
        now: Date = Date()
    ) -> [ConversationListSection] {
        var groupedConversations = Dictionary(
            uniqueKeysWithValues: orderedTitles.map { title in
                (title, [Conversation]())
            }
        )

        for conversation in conversations {
            let activityDate = conversation.lastMessageAt ?? conversation.createdAt
            let title = title(for: activityDate, calendar: calendar, now: now)
            groupedConversations[title, default: []].append(conversation)
        }

        return orderedTitles.compactMap { title in
            guard let conversations = groupedConversations[title], !conversations.isEmpty else {
                return nil
            }

            return ConversationListSection(
                id: title,
                title: title,
                conversations: conversations
            )
        }
    }

    private static func title(for activityDate: Date, calendar: Calendar, now: Date) -> String {
        if calendar.isDateInToday(activityDate) {
            return "Today"
        }

        if calendar.isDateInYesterday(activityDate) {
            return "Yesterday"
        }

        if calendar.isDate(activityDate, equalTo: now, toGranularity: .weekOfYear) {
            return "This Week"
        }

        if calendar.isDate(activityDate, equalTo: now, toGranularity: .month) {
            return "This Month"
        }

        return "Older"
    }
}
