#if canImport(ActivityKit) && os(iOS)
import ActivityKit
import Foundation

struct PolyActivityAttributes: ActivityAttributes {
    struct WorkLine: Codable, Hashable, Identifiable {
        enum State: String, Codable, Hashable {
            case running
            case needsYou
        }

        var id: String
        var title: String
        var place: String
        var step: String?
        var state: State
        var since: Date
        var link: URL?
    }

    struct ContentState: Codable, Hashable {
        var mood: String
        var needsYou: Int
        var workingOn: Int
        var focus: WorkLine?
        var next: [WorkLine]
    }
}
#endif
