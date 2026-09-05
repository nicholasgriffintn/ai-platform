import Foundation

enum OutputReviewDeepLink {
    static func outputId(from url: URL) -> String? {
        let segments = ([url.host].compactMap { $0 } + url.pathComponents)
            .filter { $0 != "/" && !$0.isEmpty }

        guard let scopeIndex = segments.firstIndex(where: { $0 == "outputs" || $0 == "responses" }),
              segments.indices.contains(scopeIndex + 1) else {
            return nil
        }

        return segments[scopeIndex + 1].removingPercentEncoding
    }
}
