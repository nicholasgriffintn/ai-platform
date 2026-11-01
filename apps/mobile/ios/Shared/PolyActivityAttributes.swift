#if canImport(ActivityKit) && os(iOS)
import ActivityKit
import Foundation

struct PolyActivityAttributes: ActivityAttributes {
    struct WorkLine: Codable, Hashable, Identifiable {
        enum State: String, Codable, Hashable {
            case running
            case needsYou
            case completed
            case failed
        }

        var id: String
        var title: String
        var place: String
        var step: String?
        var state: State
        var since: Date
        var endedAt: Date?
        var link: URL?
    }

    struct ContentState: Codable, Hashable {
        var focus: WorkLine
        var others: [WorkLine.State]
        var needsYou: Int
    }
}

extension PolyActivityAttributes.ContentState {
    private enum CodingKeys: String, CodingKey {
        case focus
        case others
        case needsYou
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        needsYou = try container.decodeIfPresent(Int.self, forKey: .needsYou) ?? 0
        others = (try? container.decodeIfPresent([PolyActivityAttributes.WorkLine.State].self, forKey: .others)) ?? []
        focus = (try? container.decodeIfPresent(PolyActivityAttributes.WorkLine.self, forKey: .focus)) ?? PolyActivityAttributes.WorkLine(
            id: "legacy",
            title: "Poly",
            place: "",
            step: nil,
            state: .running,
            since: Date(),
            endedAt: nil,
            link: nil
        )
    }
}
#endif
