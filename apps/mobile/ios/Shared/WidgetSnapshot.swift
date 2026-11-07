import Foundation

struct WidgetSnapshot: Codable, Equatable {
    struct Line: Codable, Equatable, Hashable {
        let title: String
        let detail: String?
        let systemImage: String
        var expiresAt: Date? = nil
    }

    struct Today: Codable, Equatable {
        let date: String
        let greeting: String
        let brief: [Line]
        let cards: [Line]
    }

    struct Attention: Codable, Equatable {
        let needsYou: Int
        let running: Int
        let items: [Line]
    }

    struct Poly: Codable, Equatable {
        let status: String
        let needsYou: Int
        let workingOn: Int
        let items: [Line]
        var pausedUntil: Date? = nil
    }

    var today: Today?
    var attention: Attention?
    var poly: Poly?
    var updatedAt: Date?

    static let empty = WidgetSnapshot()

    var needsYou: Int { attention?.needsYou ?? poly?.needsYou ?? 0 }
    var running: Int { attention?.running ?? poly?.workingOn ?? 0 }

    func pose(at now: Date = Date()) -> PetPose {
        if needsYou > 0 { return .wait }
        if let pausedUntil = poly?.pausedUntil, pausedUntil > now { return .doze }
        return running > 0 ? .work : .idle
    }
}

enum WidgetSnapshotStore {
    static let appGroup = "group.com.polychat-app.app"
    private static let key = "widgetSnapshot"

    static func read() -> WidgetSnapshot {
        guard let data = UserDefaults(suiteName: appGroup)?.data(forKey: key),
              let snapshot = try? JSONDecoder().decode(WidgetSnapshot.self, from: data) else {
            return .empty
        }
        return snapshot
    }

    static func update(_ change: (inout WidgetSnapshot) -> Void) {
        var snapshot = read()
        change(&snapshot)
        snapshot.updatedAt = Date()
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        UserDefaults(suiteName: appGroup)?.set(data, forKey: key)
    }

    static func clear() {
        UserDefaults(suiteName: appGroup)?.removeObject(forKey: key)
    }
}
