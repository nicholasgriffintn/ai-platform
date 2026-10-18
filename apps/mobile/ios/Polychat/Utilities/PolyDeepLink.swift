import Foundation

enum PolyDeepLink {
    static let url = URL(string: "polychat://poly")!

    static func matches(_ url: URL) -> Bool {
        url.scheme == "polychat" && url.host == "poly"
    }
}
