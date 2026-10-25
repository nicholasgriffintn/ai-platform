import Foundation

enum URLDisplay {
    static func hostAndPath(_ uri: String) -> String {
        guard let url = URL(string: uri), let host = url.host else { return uri }
        return host + url.path
    }
}
