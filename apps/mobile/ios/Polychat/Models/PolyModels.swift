import Foundation

struct PolyAgendaItem: Decodable, Identifiable, Equatable {
    let kind: String
    let itemId: String
    let title: String
    let status: String
    let conversationId: String

    var id: String { "\(kind):\(itemId)" }

    enum CodingKeys: String, CodingKey {
        case kind
        case itemId = "id"
        case title
        case status
        case conversationId = "conversation_id"
    }
}

struct PolyLookAround: Codable, Equatable {
    let enabled: Bool
    let timezone: String?
}

struct PolyAgenda: Decodable, Equatable {
    let contextId: String
    let conversationId: String
    let needsYou: [PolyAgendaItem]
    let workingOn: [PolyAgendaItem]
    let noted: [PolyAgendaItem]
    let pausedUntil: String?
    let lookAround: PolyLookAround

    enum CodingKeys: String, CodingKey {
        case contextId = "context_id"
        case conversationId = "conversation_id"
        case needsYou = "needs_you"
        case workingOn = "working_on"
        case noted
        case pausedUntil = "paused_until"
        case lookAround = "look_around"
    }
}

struct PolyPauseRequest: Encodable {
    let pausedUntil: String?

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(pausedUntil, forKey: .pausedUntil)
    }

    enum CodingKeys: String, CodingKey {
        case pausedUntil
    }
}

struct PolyLookAroundRequest: Encodable {
    let enabled: Bool
    let timezone: String
}

struct PolyContextResponse: Decodable {
    let id: String
}

enum PolyMood: String, Codable, Hashable {
    case idle
    case work
    case wait
    case doze
}

struct PolyPresence: Equatable {
    let mood: PolyMood
    let status: String

    static func derive(from agenda: PolyAgenda?, now: Date = Date()) -> PolyPresence {
        guard let agenda else {
            return PolyPresence(mood: .idle, status: "Ready when you are")
        }

        if !agenda.needsYou.isEmpty {
            let count = agenda.needsYou.count
            return PolyPresence(
                mood: .wait,
                status: count == 1 ? "One thing needs you" : "\(count) things need you"
            )
        }

        if let pausedUntil = agenda.pausedUntil.flatMap(PolyPresence.parseDate), pausedUntil > now {
            return PolyPresence(
                mood: .doze,
                status: "Paused until \(pausedUntil.formatted(date: .omitted, time: .shortened))"
            )
        }

        if !agenda.workingOn.isEmpty {
            let count = agenda.workingOn.count
            return PolyPresence(
                mood: .work,
                status: count == 1 ? "Working on one thing" : "Working on \(count) things"
            )
        }

        return PolyPresence(mood: .idle, status: "Ready when you are")
    }

    private static func parseDate(_ value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }
}
