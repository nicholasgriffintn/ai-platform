import Foundation

enum DiscoverItem: Identifiable, Hashable {
    case media(DiscoverMediaItem)
    case card(DiscoverCard)

    var id: String {
        switch self {
        case .media(let media): return "media:\(media.rawValue)"
        case .card(let card): return "card:\(card.id)"
        }
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func ordered(media: [DiscoverMediaItem], cards: [DiscoverCard]) -> [DiscoverItem] {
        let sections: [DiscoverSection] = [.topics, .forYou, .comingUp, .reading, .watching]
        let rows = sections.flatMap { section in
            cards.filter { $0.section == section && !$0.isStory }
        }
        return media.map(DiscoverItem.media) + rows.map(DiscoverItem.card)
    }

    static func step(_ items: [DiscoverItem], from current: DiscoverItem, by direction: Int) -> DiscoverItem? {
        guard !items.isEmpty else { return nil }
        guard let index = items.firstIndex(where: { $0.id == current.id }) else {
            return direction > 0 ? items.first : items.last
        }
        return items[(index + direction + items.count) % items.count]
    }

    static func position(of item: DiscoverItem, in items: [DiscoverItem]) -> String? {
        guard let index = items.firstIndex(where: { $0.id == item.id }) else { return nil }
        return "\(index + 1) of \(items.count)"
    }

    var card: DiscoverCard? {
        if case .card(let card) = self { return card }
        return nil
    }

    var label: String {
        switch self {
        case .media(.episode): return "Episode"
        case .media(.perch): return "The Perch"
        case .media(.week): return "Your week"
        case .media(.windDown): return "Wind down"
        case .card(let card):
            switch card.kind {
            case "topic": return "Worth a look"
            case "read": return "Reading"
            case "inbox": return "Inbox"
            case "action": return "Worth doing"
            case "check_in": return "Checking in"
            case "resurface": return "From before"
            case "event": return "Coming up"
            case "watch": return "Watch"
            case "listen": return "Listen"
            case "wind_down": return "Tonight's story"
            default: return "Discover"
            }
        }
    }

    var systemImage: String {
        switch self {
        case .media(let media): return media.systemImage
        case .card(let card): return card.kind == "topic" ? "safari" : card.systemImage
        }
    }

    var placeholder: String {
        switch self {
        case .media(.episode): return "Ask about this episode"
        case .media(.perch): return "Ask about today's round-up"
        case .media(.week): return "Ask about your week"
        case .media(.windDown): return ""
        case .card(let card):
            switch card.kind {
            case "topic": return "Ask about this piece"
            case "read": return "Ask about this article"
            case "inbox": return "Ask about this message"
            case "action": return "Change the plan, or ask about it"
            case "check_in": return "Reply to Poly"
            case "event": return "Ask about this event"
            case "watch": return "Ask about this video"
            case "listen": return "Ask about this episode"
            default: return "Ask about this"
            }
        }
    }

    func subject(in edition: DiscoverEdition) -> ConversationSubject? {
        switch self {
        case .media(.episode):
            return edition.episodeId.map { ConversationSubject(type: "output", id: $0) }
        case .media(.perch):
            return edition.listenSourceId.map { ConversationSubject(type: "source", id: $0) }
        case .media(.week):
            return edition.weekSourceId.map { ConversationSubject(type: "source", id: $0) }
        case .media(.windDown):
            return nil
        case .card(let card):
            return card.isStory ? nil : card.subject(editionId: edition.id)
        }
    }

    var suggestions: [DiscoverSuggestion] {
        switch self {
        case .media(.episode):
            return [
                DiscoverSuggestion("Recap it in three lines", "Recap this episode in three lines."),
                DiscoverSuggestion("What's the main argument?", "What is the main argument of this episode, and how well does it hold up?"),
                DiscoverSuggestion("What should I read next on this?", "Based on this episode, what should I read or watch next on the topic?")
            ]
        case .media(.perch), .media(.week):
            return [
                DiscoverSuggestion("What were the main stories?", "What were the main stories in this, in a sentence each?"),
                DiscoverSuggestion("Recap it in three lines", "Recap this in three lines."),
                DiscoverSuggestion("What should I follow up on?", "From this, what is worth following up on, and why?")
            ]
        case .media(.windDown):
            return []
        case .card(let card):
            return card.suggestions
        }
    }
}

struct DiscoverSuggestion: Identifiable, Equatable {
    let label: String
    let prompt: String

    var id: String { label }

    init(_ label: String, _ prompt: String) {
        self.label = label
        self.prompt = prompt
    }
}

extension DiscoverCard {
    var eyebrow: String {
        switch kind {
        case "topic": return topic ?? ""
        case "read": return [source, topic].compactMap { $0 }.joined(separator: " · ")
        case "action": return when.map { "Worth doing · \($0)" } ?? "Worth doing"
        case "check_in": return "Checking in"
        case "resurface": return "From before"
        case "watch": return "Watch · \(source ?? "")"
        case "listen": return "Listen · \(source ?? "")"
        case "event": return [when, `where`].compactMap { $0 }.joined(separator: " · ")
        case "inbox": return "From \(source ?? "your inbox")"
        case "wind_down": return "Wind down · \(topic ?? "")"
        default: return topic ?? ""
        }
    }

    var isReading: Bool {
        kind == "read" || kind == "inbox"
    }

    var isSummarised: Bool {
        isReading || kind == "watch" || kind == "listen"
    }

    var linkLabel: String? {
        guard externalURL != nil else { return nil }
        switch kind {
        case "read", "watch", "listen", "inbox": return "Open on \(source ?? "the web")"
        default: return "Open it"
        }
    }

    func relatedReading(in cards: [DiscoverCard], limit: Int = 2) -> [DiscoverCard] {
        guard isReading else { return [] }
        let others = cards.filter { $0.isReading && $0.id != id }
        let key = topic?.lowercased()
        let sameTopic = others.filter { $0.topic?.lowercased() == key }
        let rest = others.filter { candidate in !sameTopic.contains { $0.id == candidate.id } }
        return Array((sameTopic + rest).prefix(limit))
    }

    var suggestions: [DiscoverSuggestion] {
        let title = self.title ?? headline
        switch kind {
        case "topic":
            let topic = self.topic ?? title
            return [
                prompt.map { DiscoverSuggestion(title, $0) },
                DiscoverSuggestion("Catch me up on \(topic)", "Catch me up on \(topic): what's happened recently and why it matters to me."),
                DiscoverSuggestion("Keep me posted on this", "Set up an automation that keeps me posted on \(topic) each week. Show me the schedule before you create it.")
            ].compactMap { $0 }
        case "read":
            let piece = sourceId == nil ? (url ?? title) : "this piece"
            let read = sourceId == nil ? "Read " : ""
            let joiner = read.isEmpty ? ":" : " and"
            return [
                DiscoverSuggestion("Give me the gist", "\(read)\(piece)\(joiner) give me the gist in five bullet points."),
                DiscoverSuggestion("Why does this matter to me?", "\(read)\(piece). Given what you know about me, why might it matter?"),
                DiscoverSuggestion("What's the other side?", "\(read)\(piece)\(joiner) give me the strongest counterargument to it.")
            ]
        case "action":
            return [
                prompt.map { DiscoverSuggestion(title, $0) },
                DiscoverSuggestion("Talk me through it first", "Before we do anything: \(detail ?? title) Talk me through the options.")
            ].compactMap { $0 }
        case "check_in":
            let question = self.question ?? title
            return [
                DiscoverSuggestion("It went well", "\(question) It went well."),
                DiscoverSuggestion("Not yet, help me with it", "\(question) Not yet. Help me with it.")
            ]
        case "resurface":
            return [
                DiscoverSuggestion("Remind me what this was", "Remind me what \"\(title)\" was about and where I left it."),
                DiscoverSuggestion("What should I do with it now?", "Looking again at \"\(title)\": \(detail ?? "") What would be a useful next step?")
            ]
        case "watch", "listen":
            let from = source ?? "the web"
            return [
                DiscoverSuggestion("What is this about?", "Tell me about \"\(title)\" from \(from) (\(url ?? "")) and whether it is worth my time."),
                DiscoverSuggestion("More like this", "Find me more like \"\(title)\" from \(from), given what you know I like.")
            ]
        case "event":
            let when = self.when ?? "the day"
            let place = self.where.map { " at \($0)" } ?? ""
            return [
                DiscoverSuggestion("Add it to my calendar", "Add \"\(title)\" on \(when)\(place) to my calendar. Show me the event before you create it."),
                DiscoverSuggestion("Remind me beforehand", "Remind me about \"\(title)\" an hour before \(when).")
            ]
        case "inbox":
            let from = source ?? "my inbox"
            let link = url.map { " (\($0))" } ?? ""
            return [
                DiscoverSuggestion("Give me the gist", "Give me the gist of \"\(title)\" from \(from)\(link) in five bullet points."),
                DiscoverSuggestion("Save it for later", "Save \"\(title)\" from \(from)\(link) to my reading list.")
            ]
        default:
            return []
        }
    }
}
