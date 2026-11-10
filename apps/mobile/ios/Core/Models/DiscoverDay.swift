import Foundation

enum DiscoverDayMode: String, Codable, CaseIterable, Identifiable {
    case office, remote, off
    var id: String { rawValue }
    var label: String {
        switch self {
        case .office: return "In the office"
        case .remote: return "Working from home"
        case .off: return "Day off"
        }
    }
}

struct DiscoverDayProfile: Codable, Equatable {
    struct Workday: Codable, Equatable, Identifiable {
        var weekday: Int
        var mode: DiscoverDayMode
        var start: String
        var end: String
        var outbound: String
        var returning: String
        var id: Int { weekday }
    }
    struct Moments: Codable, Equatable {
        var morning: String
        var lunch: String
        var afternoon: String
        var evening: String
    }
    struct Place: Codable, Equatable {
        let label: String
        let latitude: Double
        let longitude: Double
    }
    struct Commute: Codable, Equatable {
        var provider: String
        var origin: Place
        var destination: Place
        var alertDelayMinutes: Int
    }
    struct LineStatus: Codable, Equatable {
        var enabled: Bool
        var lines: [String]
        var nearby: Bool

        static let off = LineStatus(enabled: false, lines: [], nearby: true)
    }
    struct Override: Codable, Equatable {
        var date: String
        var mode: DiscoverDayMode
        var outbound: String?
        var returning: String?
    }
    struct Notifications: Codable, Equatable {
        var enabled: Bool
        var commute: Bool
        var weather: Bool
        var news: Bool
        var briefings: Bool
        var dailyLimit: Int
        var quietStart: String
        var quietEnd: String
        var quietWhileWorking: Bool
    }
    struct Audio: Codable, Equatable {
        struct Slot: Codable, Equatable {
            var enabled: Bool
            var time: String
        }
        var morning: Slot
        var evening: Slot
    }
    var version: Int
    var timezone: String
    var onboarded: Bool
    var week: [Workday]
    var moments: Moments
    var weatherLocation: Place?
    var commute: Commute?
    var lineStatus: LineStatus?
    var topics: [String]
    var mutedTopics: [String]
    var overrides: [Override]
    var notifications: Notifications
    var audio: Audio
    let revision: Int
    let updatedAt: String?
}

struct DiscoverDayRequest: Encodable {
    let expectedRevision: Int
    var timezone: String?
    var onboarded: Bool?
    var week: [DiscoverDayProfile.Workday]?
    var moments: DiscoverDayProfile.Moments?
    var topics: [String]?
    var mutedTopics: [String]?
    var notifications: DiscoverDayProfile.Notifications?
    var audio: DiscoverDayProfile.Audio?
    var lineStatus: DiscoverDayProfile.LineStatus?
    var override: DiscoverDayProfile.Override?
    var removeOverride: String?
}

struct DiscoverTransitLine: Identifiable, Equatable {
    let id: String
    let name: String

    static let all: [DiscoverTransitLine] = [
        ("bakerloo", "Bakerloo"), ("central", "Central"), ("circle", "Circle"), ("district", "District"),
        ("hammersmith-city", "Hammersmith & City"), ("jubilee", "Jubilee"), ("metropolitan", "Metropolitan"),
        ("northern", "Northern"), ("piccadilly", "Piccadilly"), ("victoria", "Victoria"),
        ("waterloo-city", "Waterloo & City"), ("elizabeth", "Elizabeth line"), ("dlr", "DLR"),
        ("liberty", "Liberty"), ("lioness", "Lioness"), ("mildmay", "Mildmay"), ("suffragette", "Suffragette"),
        ("weaver", "Weaver"), ("windrush", "Windrush"), ("tram", "Tram")
    ].map { DiscoverTransitLine(id: $0.0, name: $0.1) }
}

struct DiscoverDeviceLocation: Encodable, Equatable {
    let latitude: Double
    let longitude: Double
}

struct DiscoverNow: Decodable, Equatable {
    struct Context: Decodable, Equatable {
        let date: String
        let timezone: String
        let mode: DiscoverDayMode
        let moment: String
        let working: Bool
        let overridden: Bool
    }
    struct Observation: Decodable, Equatable, Identifiable {
        let id: String
        let kind: String
        let title: String
        let text: String
        let source: String
        let href: String?
        let observedAt: String
        let expiresAt: String
        let actionable: Bool
        let stale: Bool
        var startsAt: String? = nil
        var endsAt: String? = nil

        var isStale: Bool {
            stale || (AppDateParser.parse(expiresAt).map { $0 <= Date() } ?? true)
        }
    }
    let context: Context
    let title: String
    struct LineReading: Decodable, Equatable {
        let id: String
        let name: String
        let status: String
        let disrupted: Bool
        let reason: String?
        let nearby: Bool
    }
    let observations: [Observation]
    var lines: [LineReading]? = nil
    var health: DiscoverHealthSummary? = nil
    let checkedAt: String?
    let updatedAt: String?
    let nextRefreshAt: String
}

struct DiscoverFeedItem: Decodable, Equatable, Identifiable {
    let id: String
    let revision: Int
    let sequence: Int
    let editionId: String
    let card: DiscoverCard
    let publishedAt: String?
    let observedAt: String
    let updatedAt: String
    let expiresAt: String
    var seen: Bool
    let dismissed: Bool
    var signals: [String]
}

struct DiscoverFeedPage: Decodable, Equatable {
    var items: [DiscoverFeedItem]
    private let lastId: String?
    private let hasMore: Bool
    let unseenCount: Int
    let updatedAt: String?

    var nextCursor: String? { hasMore ? lastId : nil }

    enum CodingKeys: String, CodingKey {
        case items = "data"
        case lastId = "last_id"
        case hasMore = "has_more"
        case unseenCount, updatedAt
    }
}

struct DiscoverAudioRelease: Decodable, Equatable, Identifiable {
    let id: String
    let date: String
    let slot: String
    let editionId: String?
    let sourceId: String?
    let status: String
    let createdAt: String
}

struct DiscoverSeenRequest: Encodable {
    struct Receipt: Encodable {
        let id: String
        let revision: Int
    }
    let items: [Receipt]
}

struct DiscoverMutationResponse: Decodable {
    let updated: Int
}
