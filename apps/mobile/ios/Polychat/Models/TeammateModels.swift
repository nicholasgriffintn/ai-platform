import Foundation

struct TeammateSummary: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let description: String
    let avatarUrl: String?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case description
        case avatarUrl = "avatar_url"
    }
}

struct TeammateListResponse: Decodable {
    let data: [TeammateSummary]
}

enum TeammateRosterEntry: Decodable, Equatable, Identifiable {
    case teammate(teammateId: String, conversationId: String, lastActivityAt: String, unread: Bool)
    case group(name: String, teammateIds: [String], conversationId: String, lastActivityAt: String, unread: Bool)

    var id: String { conversationId }

    var conversationId: String {
        switch self {
        case let .teammate(_, conversationId, _, _), let .group(_, _, conversationId, _, _):
            return conversationId
        }
    }

    var unread: Bool {
        switch self {
        case let .teammate(_, _, _, unread), let .group(_, _, _, _, unread):
            return unread
        }
    }

    var leadTeammateId: String? {
        switch self {
        case let .teammate(teammateId, _, _, _):
            return teammateId
        case let .group(_, teammateIds, _, _, _):
            return teammateIds.first
        }
    }

    private enum CodingKeys: String, CodingKey {
        case kind
        case teammateId
        case conversationId
        case lastActivityAt
        case unread
        case name
        case teammateIds
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let conversationId = try container.decode(String.self, forKey: .conversationId)
        let lastActivityAt = try container.decode(String.self, forKey: .lastActivityAt)
        let unread = try container.decode(Bool.self, forKey: .unread)

        switch try container.decode(String.self, forKey: .kind) {
        case "group":
            self = .group(
                name: try container.decode(String.self, forKey: .name),
                teammateIds: try container.decode([String].self, forKey: .teammateIds),
                conversationId: conversationId,
                lastActivityAt: lastActivityAt,
                unread: unread
            )
        default:
            self = .teammate(
                teammateId: try container.decode(String.self, forKey: .teammateId),
                conversationId: conversationId,
                lastActivityAt: lastActivityAt,
                unread: unread
            )
        }
    }
}

struct TeammateRosterResponse: Decodable {
    let data: [TeammateRosterEntry]
}

struct TeammateRosterRow: Identifiable, Equatable {
    let entry: TeammateRosterEntry
    let title: String
    let subtitle: String

    var id: String { entry.id }
}

enum TeammateRoster {
    static func rows(entries: [TeammateRosterEntry], teammates: [TeammateSummary]) -> [TeammateRosterRow] {
        let names = Dictionary(teammates.map { ($0.id, $0.name) }, uniquingKeysWith: { first, _ in first })

        return entries.map { entry in
            switch entry {
            case let .teammate(teammateId, _, _, _):
                let teammate = teammates.first { $0.id == teammateId }
                return TeammateRosterRow(
                    entry: entry,
                    title: teammate?.name ?? "Teammate",
                    subtitle: teammate?.description ?? ""
                )
            case let .group(name, teammateIds, _, _, _):
                return TeammateRosterRow(
                    entry: entry,
                    title: name,
                    subtitle: teammateIds.compactMap { names[$0] }.joined(separator: ", ")
                )
            }
        }
    }

    static func teammatesByConversation(_ entries: [TeammateRosterEntry]) -> [String: String] {
        Dictionary(
            entries.compactMap { entry in entry.leadTeammateId.map { (entry.conversationId, $0) } },
            uniquingKeysWith: { first, _ in first }
        )
    }

    static func teammatesWithoutConversations(
        entries: [TeammateRosterEntry],
        teammates: [TeammateSummary]
    ) -> [TeammateSummary] {
        let talking = Set(entries.compactMap { entry -> String? in
            if case let .teammate(teammateId, _, _, _) = entry { return teammateId }
            return nil
        })

        return teammates.filter { !talking.contains($0.id) }
    }
}
