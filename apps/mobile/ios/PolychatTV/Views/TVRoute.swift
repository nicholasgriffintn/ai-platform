import Foundation

enum TVRoute: Hashable {
    case episode
    case perch
    case week
    case windDown
    case card(String)

    init(item: DiscoverMediaItem) {
        switch item {
        case .episode: self = .episode
        case .perch: self = .perch
        case .week: self = .week
        case .windDown: self = .windDown
        }
    }

    init?(url: URL) {
        guard url.scheme == "polychat", url.host == "discover" else { return nil }
        let parts = url.pathComponents.filter { $0 != "/" }

        switch parts.first {
        case "episode":
            self = .episode
        case "perch":
            self = .perch
        case "week":
            self = .week
        case "wind-down":
            self = .windDown
        case "cards" where parts.count > 1:
            self = .card(parts[1])
        default:
            return nil
        }
    }

    var url: URL {
        switch self {
        case .episode:
            return URL(string: "polychat://discover/episode")!
        case .perch:
            return URL(string: "polychat://discover/perch")!
        case .week:
            return URL(string: "polychat://discover/week")!
        case .windDown:
            return URL(string: "polychat://discover/wind-down")!
        case .card(let id):
            var components = URLComponents()
            components.scheme = "polychat"
            components.host = "discover"
            components.path = "/cards/\(id)"
            return components.url!
        }
    }
}
