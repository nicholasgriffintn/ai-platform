import Foundation

enum AppTab: Hashable {
    case home
    case chats
    case work
    case attention
    case settings
}

enum DiscoverLink: Equatable {
    case media(DiscoverMediaItem)
    case card(String)
}

enum AppRoute: Equatable {
    case tab(AppTab)
    case discover(DiscoverLink)
    case conversation(String)
    case poly
    case device(String)
    case work(MobileWorkTarget)

    static func workLink(_ target: MobileWorkTarget) -> URL? {
        var path = "polychat://work/\(target.workspaceId)/projects/\(target.projectId)"
        if let runId = target.runId {
            path += "/runs/\(runId)"
        } else if let taskId = target.taskId {
            path += "/tasks/\(taskId)"
        } else if let conversationId = target.conversationId {
            path += "/chat/\(conversationId)"
        }
        return URL(string: path)
    }

    private static func workTarget(segments: [String]) -> MobileWorkTarget? {
        guard segments.count >= 4, segments[2] == "projects" else { return nil }
        let item = segments.count >= 6 ? segments[5] : nil
        let kind = segments.count >= 5 ? segments[4] : nil
        return MobileWorkTarget(
            workspaceId: segments[1],
            projectId: segments[3],
            conversationId: kind == "chat" ? item : nil,
            taskId: kind == "tasks" ? item : nil,
            runId: kind == "runs" ? item : nil,
            interactionId: nil
        )
    }

    static func parse(_ url: URL) -> AppRoute? {
        let isNative = url.scheme == "polychat"
        guard isNative || url.host == "polychat.app" else {
            return nil
        }

        let segments = ((isNative ? [url.host].compactMap { $0 } : []) + url.pathComponents)
            .filter { $0 != "/" && !$0.isEmpty }

        guard let first = segments.first else {
            return isNative ? .tab(.home) : nil
        }

        if segments.contains("attention") {
            return .tab(.attention)
        }

        switch first {
        case "device":
            let code = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?.first { $0.name == "user_code" }?.value
            return code.map(AppRoute.device)
        case "discover", "home":
            if segments.count == 3, segments[1] == "cards" {
                return .discover(.card(segments[2]))
            }
            if segments.count == 2, let item = DiscoverMediaItem(slug: segments[1]) {
                return .discover(.media(item))
            }
            return .tab(.home)
        case "settings":
            return .tab(.settings)
        case "poly":
            return .poly
        case "work":
            return workTarget(segments: segments).map(AppRoute.work) ?? .tab(.work)
        case "chat":
            guard segments.count == 2, segments[1] != "new" else {
                return .tab(.chats)
            }
            return .conversation(segments[1])
        default:
            return nil
        }
    }
}
