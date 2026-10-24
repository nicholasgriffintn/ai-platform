import Foundation

enum DiscoverDeepLink {
    static let url = URL(string: "polychat://discover")!

    static func matches(_ url: URL) -> Bool {
        url.scheme == "polychat" && url.host == "discover"
    }
}
