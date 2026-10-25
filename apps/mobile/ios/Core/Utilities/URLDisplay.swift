import Foundation

enum URLDisplay {
    static func hostAndPath(_ uri: String) -> String {
        guard let url = URL(string: uri), let host = url.host else { return uri }
        return host + url.path
    }

    static func faviconURL(_ uri: String) -> URL? {
        guard let host = URL(string: uri)?.host, !host.isEmpty,
              let encoded = host.addingPercentEncoding(withAllowedCharacters: .urlHostAllowed)
        else { return nil }
        return URL(string: "https://icons.duckduckgo.com/ip3/\(encoded).ico")
    }
}
