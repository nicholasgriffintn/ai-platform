#if canImport(ActivityKit) && os(iOS)
import ActivityKit
import Foundation

struct PolyActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var mood: String
        var status: String
        var needsYou: Int
        var workingOn: Int
        var headline: String?
    }
}
#endif
