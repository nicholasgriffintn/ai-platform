import Foundation

struct DiscoverSettings: Decodable, Equatable {
    let enabled: Bool
    let timezone: String?
    let curate: String
    let listen: Bool?
    let evening: Bool?
    let episode: String?
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
    let `where`: String?
    let question: String?
    let premise: String?
    let href: String?
    let reason: String
    let coverId: String?
    let sourceId: String?

    var headline: String { question ?? title ?? "" }

    var section: DiscoverSection {
        switch kind {
        case "topic", "wind_down": return .topics
        case "event": return .comingUp
        case "read", "inbox": return .reading
        case "watch", "listen": return .watching
        default: return .forYou
        }
    }

    var systemImage: String {
        switch kind {
        case "read": return "doc.text"
        case "watch": return "play.rectangle"
        case "listen": return "headphones"
        case "event": return "calendar"
        case "inbox": return "envelope"
        case "action": return "bolt"
        case "check_in": return "bubble.left.and.text.bubble.right"
        case "resurface": return "arrow.uturn.backward"
        case "wind_down": return "moon.stars"
        default: return "sparkles"
        }
    }

    var externalURL: URL? {
        (url ?? href).flatMap(URL.init(string:)).flatMap { $0.scheme?.hasPrefix("http") == true ? $0 : nil }
    }

    var body: String? { angle ?? summary ?? detail ?? premise }

    var storyRequest: DiscoverWindDownRequest? {
        guard kind == "wind_down" else { return nil }
        return DiscoverWindDownRequest(
            kind: "story",
            minutes: DiscoverWindDown.storyMinutes,
            topic: topic,
            premise: premise
        )
    }

    func subject(editionId: String) -> ConversationSubject {
        if kind == "read", let sourceId {
            return ConversationSubject(type: "source", id: sourceId)
        }
        return ConversationSubject(type: "discover_card", id: "\(editionId):\(id)")
    }

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

enum DiscoverSection: CaseIterable {
    case topics
    case forYou
    case comingUp
    case reading
    case watching

    var title: String {
        switch self {
        case .topics: return "Worth a look"
        case .forYou: return "For you"
        case .comingUp: return "Coming up"
        case .reading: return "Reading"
        case .watching: return "Watching and listening"
        }
    }
}

struct DiscoverInterest: Decodable, Equatable {
    let topic: String
    let reason: String
}

struct DiscoverEdition: Decodable, Equatable {
    let id: String
    let date: String
    let greeting: String
    let interests: [DiscoverInterest]?
    let brief: [DiscoverBriefLine]
    let cards: [DiscoverCard]
    let feedback: [String: [String]]
    let listenSourceId: String?
    let weekSourceId: String?
    let edition: String?
    let episodeId: String?
    let episodeOverBudget: Bool?
    let episodeFailed: Bool?
}

struct DiscoverEditionSummary: Decodable, Equatable, Identifiable {
    let id: String
    let date: String
    let edition: String

    var isEvening: Bool { edition == "evening" }

    var day: Date? {
        DiscoverEditionSummary.dayFormatter.date(from: date)
    }

    var label: String {
        guard let day else { return date }
        let name = Calendar.current.isDateInToday(day)
            ? "Today"
            : Calendar.current.isDateInYesterday(day)
                ? "Yesterday"
                : day.formatted(.dateTime.weekday(.abbreviated).day())
        return isEvening ? "\(name) evening" : name
    }

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .iso8601)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}

struct DiscoverFollowRequest: Encodable {
    let topic: String
}

struct DiscoverUnfollowResponse: Decodable {
    let notebookId: String
}

struct DiscoverResponse: Decodable, Equatable {
    let settings: DiscoverSettings
    let edition: DiscoverEdition?
    let editions: [DiscoverEditionSummary]
    let follows: [DiscoverFollow]
    let windDownId: String?
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
    var enabled: Bool?
    var timezone: String?
    var listen: Bool?
    var evening: Bool?
}

enum DiscoverRecording: String {
    case listen
    case week
}

enum DiscoverMediaItem: String, Identifiable, CaseIterable {
    case episode
    case perch
    case week
    case windDown

    var id: String { rawValue }

    init?(slug: String) {
        guard let item = Self.allCases.first(where: { $0.slug == slug }) else { return nil }
        self = item
    }

    var slug: String {
        self == .windDown ? "wind-down" : rawValue
    }

    var title: String {
        switch self {
        case .episode: return "Today's episode"
        case .perch: return "The Perch"
        case .week: return "Your week"
        case .windDown: return "Wind down"
        }
    }
}

struct DiscoverMediaState: Equatable {
    var title: String
    var status: String
    var isReady: Bool
    var coverKey: String?
    var isWorking = false
}

struct DiscoverEpisode: Decodable, Equatable {
    struct Shot: Decodable, Equatable {
        let image: Bool
    }

    struct Scene: Decodable, Equatable {
        let title: String
        let caption: String?
        let shots: [Shot]
    }

    struct Timing: Decodable, Equatable {
        let start: Double
        let end: Double
    }

    struct Chapter: Decodable, Equatable {
        let title: String
        let scenes: [Scene]
        let status: String
        let timings: [Timing]

        var isReady: Bool { status == "ready" }

        func shot(at seconds: Double) -> (scene: Int, shot: Int) {
            let current = timings.firstIndex { seconds < $0.end }
            let sceneIndex = current ?? max(0, timings.count - 1)
            guard scenes.indices.contains(sceneIndex), timings.indices.contains(sceneIndex) else {
                return (0, 0)
            }
            let timing = timings[sceneIndex]
            let shots = max(1, scenes[sceneIndex].shots.count)
            let shotSeconds = max(1, (timing.end - timing.start) / Double(shots))
            let shot = min(shots - 1, max(0, Int((seconds - timing.start) / shotSeconds)))
            return (sceneIndex, shot)
        }
    }

    struct Resume: Codable, Equatable {
        let chapter: Int
        let seconds: Double
    }

    struct Progress: Decodable, Equatable {
        let furthest: Double
        let resume: Resume?
    }

    let id: String
    let title: String
    let recap: String
    let topic: String
    let part: Int
    let parts: Int
    let chapters: [Chapter]
    let progress: Progress?

    func watchedFraction(chapter index: Int, seconds: Double) -> Double {
        let lengths = chapters.map { $0.timings.last?.end ?? 0 }
        let total = lengths.reduce(0, +)
        let before = lengths.prefix(index).reduce(0, +)
        return total > 0 ? min(1, (before + seconds) / total) : 0
    }
}

struct DiscoverEpisodeProgressRequest: Encodable {
    let fraction: Double
    let resume: DiscoverEpisode.Resume
}

struct DiscoverWindDown: Decodable, Equatable {
    struct Kind: Identifiable {
        let id: String
        let title: String
        let detail: String
    }

    static let kinds = [
        Kind(id: "breathing", title: "Breathing", detail: "Slow, counted breaths"),
        Kind(id: "body_scan", title: "Body scan", detail: "Attention moves from head to toe"),
        Kind(id: "unwind", title: "Unwind", detail: "Set today down, one thing at a time"),
        Kind(id: "story", title: "Slow story", detail: "Nothing much happens, on purpose"),
        Kind(id: "read_back", title: "Read back", detail: "Your own highlights, read slowly"),
        Kind(id: "park", title: "Park tomorrow", detail: "Say what's on your mind, find it in the morning"),
        Kind(id: "sound", title: "Just the sound", detail: "No voice, only the sound and the scene")
    ]
    static let lengths = [5, 10, 20, 30]
    static let beds = ["night", "rain", "sea", "embers", "aurora"]
    static let afterVoiceMinutes = [0, 15, 30, 60]
    static let storyMinutes = 20

    static func title(forKind id: String) -> String {
        kinds.first { $0.id == id }?.title ?? id
    }

    struct Step: Decodable, Equatable {
        let text: String
        let pauseSeconds: Int
        let audio: Bool
    }

    let id: String
    let kind: String
    let minutes: Int
    let title: String
    let steps: [Step]
    let status: String
    let bed: String?
    let ambient: Bool?
    let topic: String?
    let part: Int?
    let parked: [String]?

    var isSoundOnly: Bool { kind == "sound" }
    var sceneBed: String { bed ?? "night" }
    var isReady: Bool { isSoundOnly ? ambient == true : steps.first?.audio == true }
}

struct DiscoverWindDownRequest: Encodable {
    var kind: String
    var minutes: Int
    var bed: String?
    var aboutToday: Bool?
    var topic: String?
    var premise: String?
    var notes: String?
}

struct DiscoverWindDownTonight: Decodable, Equatable {
    let kind: String
    let minutes: Int
    let bed: String
    let topic: String?
    let reason: String
    let readBack: Bool

    func request(aboutToday: Bool) -> DiscoverWindDownRequest {
        DiscoverWindDownRequest(
            kind: kind,
            minutes: minutes,
            bed: bed,
            aboutToday: aboutToday ? nil : false,
            topic: topic
        )
    }
}

struct DiscoverListenResponse: Decodable {
    let sourceId: String
}

struct MediaSource: Decodable, Equatable {
    struct File: Decodable, Equatable {
        let mimeType: String?
    }

    struct Metadata: Decodable, Equatable {
        let listen: SourceListen?
    }

    let id: String
    let title: String
    let status: String
    let file: File?
    let metadata: Metadata?

    var isPlayable: Bool { status == "available" && file != nil }
    var listen: SourceListen? { metadata?.listen }
}

struct SourceListen: Decodable, Equatable {
    struct Passage: Decodable, Equatable {
        let text: String
        let audio: Bool
    }

    let status: String
    let contentHash: String
    let passages: [Passage]

    var isMaking: Bool { status == "making" }
    var isFailed: Bool { status == "failed" }
    var isPlayable: Bool { passages.first?.audio == true }
}

struct DiscoverHealthSummary: Codable, Equatable {
    let date: String
    let sleepMinutes: Int?
    let mindfulMinutes: Int?
    let exerciseMinutes: Int?

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(date, forKey: .date)
        try container.encode(sleepMinutes, forKey: .sleepMinutes)
        try container.encode(mindfulMinutes, forKey: .mindfulMinutes)
        try container.encode(exerciseMinutes, forKey: .exerciseMinutes)
    }
}
