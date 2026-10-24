import Foundation

struct DiscoverSettings: Decodable, Equatable {
    let enabled: Bool
    let timezone: String?
    let curate: String
}

struct DiscoverFollow: Decodable, Equatable, Identifiable {
    let notebookId: String
    let topic: String

    var id: String { notebookId }
}

struct DiscoverBriefLine: Decodable, Equatable, Identifiable {
    let kind: String
    let label: String
    let text: String
    let href: String?

    var id: String { "\(label):\(text)" }

    var systemImage: String {
        switch kind {
        case "waiting": return "bell.badge"
        case "calendar": return "calendar"
        case "topic": return "sparkles"
        case "weather": return "cloud.sun"
        case "on_this_day": return "clock.arrow.circlepath"
        default: return "leaf"
        }
    }
}

struct DiscoverCard: Decodable, Equatable, Identifiable {
    let id: String
    let kind: String
    let topic: String?
    let title: String?
    let angle: String?
    let prompt: String?
    let url: String?
    let source: String?
    let summary: String?
    let detail: String?
    let when: String?
    let question: String?
    let href: String?
    let reason: String
    let coverId: String?

    var headline: String { question ?? title ?? "" }

    var body: String? { angle ?? summary ?? detail }

    var chatPrompt: String {
        if let prompt { return prompt }
        if kind == "resurface", let title {
            return "Remind me what \"\(title)\" was about and where I left it."
        }
        if kind == "read", let title, let url {
            return "I saw \"\(title)\" (\(url)). What's the gist, and why might it matter to me?"
        }
        return "About your question, \"\(question ?? "")\": "
    }
}

struct DiscoverEdition: Decodable, Equatable {
    let id: String
    let date: String
    let greeting: String
    let brief: [DiscoverBriefLine]
    let cards: [DiscoverCard]
    let feedback: [String: [String]]
    let listenSourceId: String?
}

struct DiscoverResponse: Decodable, Equatable {
    let settings: DiscoverSettings
    let edition: DiscoverEdition?
    let follows: [DiscoverFollow]
}

struct DiscoverRefreshResponse: Decodable {
    let status: String
    let taskId: String?
}

struct DiscoverFeedbackRequest: Encodable {
    let editionId: String
    let cardId: String
    let signal: String
}

struct DiscoverFeedbackResponse: Decodable {
    let cardId: String
    let signals: [String]
}

struct DiscoverSettingsRequest: Encodable {
    let enabled: Bool
    let timezone: String?
}
