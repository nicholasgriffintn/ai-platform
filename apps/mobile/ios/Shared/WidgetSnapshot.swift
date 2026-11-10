import Foundation

struct WidgetSnapshot: Codable, Equatable {
    struct Line: Codable, Equatable, Hashable {
        let title: String
        let detail: String?
        let systemImage: String
        var expiresAt: Date? = nil
        var kind: String? = nil
    }

    struct Health: Codable, Hashable {
        var sleepMinutes: Int?
        var steps: Int?
        var restingHeartRate: Int?
        var restingHeartRateUsual: Int?
        var heartRateVariability: Int?
        var heartRateVariabilityUsual: Int?
        let observedAt: Date

        var vitalsNote: String? {
            if let resting = restingHeartRate, let usual = restingHeartRateUsual, resting - usual >= 5 {
                return "Resting heart rate \(resting - usual) bpm above usual"
            }
            if let variability = heartRateVariability, let usual = heartRateVariabilityUsual, usual > 0,
               Double(variability) < Double(usual) * 0.8 {
                return "Heart rate variability lower than usual"
            }
            if restingHeartRate != nil || heartRateVariability != nil {
                return "Vitals in your usual range"
            }
            return nil
        }

        var needsAttention: Bool {
            vitalsNote.map { !$0.hasPrefix("Vitals in") } ?? false
        }

        var summary: String? {
            let parts = [
                sleepMinutes.map { "\($0 / 60)h \($0 % 60)m sleep" },
                steps.map { "\($0.formatted()) steps" },
                restingHeartRate.map { "\($0) bpm resting" }
            ].compactMap { $0 }
            return parts.isEmpty ? nil : parts.joined(separator: " · ")
        }
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
    var health: Health?
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

enum WidgetPreferences {
    private static let calendarKey = "widgetShowsCalendar"

    static var showsCalendar: Bool {
        get { UserDefaults(suiteName: WidgetSnapshotStore.appGroup)?.bool(forKey: calendarKey) ?? false }
        set { UserDefaults(suiteName: WidgetSnapshotStore.appGroup)?.set(newValue, forKey: calendarKey) }
    }
}
