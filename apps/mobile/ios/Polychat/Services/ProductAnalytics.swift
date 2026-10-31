import Foundation

@MainActor
final class ProductAnalytics {
    static let shared = ProductAnalytics()

    private static let batchLimit = 50
    private static let flushDelay: Duration = .seconds(2)

    private let client: APIClient
    let sessionId = UUID().uuidString
    private let appVersion = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
    private var queue: [ClientAnalyticsEvent] = []
    private var flushTask: Task<Void, Never>?

    private let environment = Bundle.main.object(forInfoDictionaryKey: "AppEnvironment") as? String ?? "unknown"

    init(client: APIClient = .shared) {
        self.client = client
    }

    func track(_ name: String, category: String, path: String? = nil, properties: [String: String] = [:]) {
        queue.append(
            ClientAnalyticsEvent(
                name: name,
                category: category,
                path: path,
                properties: properties.isEmpty ? nil : properties
            )
        )

        if queue.count >= Self.batchLimit {
            flush()
            return
        }

        guard flushTask == nil else { return }
        flushTask = Task { [weak self] in
            try? await Task.sleep(for: Self.flushDelay)
            self?.flush()
        }
    }

    func trackScreen(_ path: String) {
        track("page_view", category: "navigation", path: path)
    }

    func flush() {
        flushTask?.cancel()
        flushTask = nil
        guard !queue.isEmpty else { return }

        let events = Array(queue.prefix(Self.batchLimit))
        queue.removeFirst(events.count)
        let batch = ClientAnalyticsBatch(
            app: "ios",
            environment: environment,
            appVersion: appVersion,
            sessionId: sessionId,
            events: events
        )

        Task { [weak self] in
            _ = try? await self?.client.sendRipple(batch)
            if self?.queue.isEmpty == false {
                self?.flush()
            }
        }
    }
}

extension AppTab {
    var analyticsPath: String {
        switch self {
        case .home: "/"
        case .chats: "/chat"
        case .work: "/work"
        case .attention: "/chat/attention"
        case .settings: "/settings"
        }
    }
}
