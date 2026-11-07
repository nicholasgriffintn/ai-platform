import Foundation
import WidgetKit

struct PerchPreferences: Codable, Equatable {
    static let milestoneChoices = [0, 10, 25, 50]

    var selection = PetSelection.default
    var animated = false
    var feelOverrides: [String: CrownFeel] = [:]
    var windToApprove = true
    var milestoneEvery = 10
    var updatedAt = Date.distantPast

    func merged(with incoming: PerchPreferences) -> PerchPreferences {
        incoming.updatedAt > updatedAt ? incoming : self
    }

    func feelOverride(for selection: PetSelection) -> CrownFeel? {
        feelOverrides[selection.key]
    }

    static func milestoneLabel(_ turns: Int) -> String {
        turns == 0 ? "Off" : "Every \(turns) turns"
    }
}

struct PerchStats: Codable, Equatable {
    var day = ""
    var turnsToday = 0.0
    var totalTurns = 0.0
    var longestSpin = 0.0

    mutating func record(turns: Double, longestSpin spin: Double, day today: String) {
        if day != today {
            day = today
            turnsToday = 0
        }
        turnsToday += turns
        totalTurns += turns
        longestSpin = max(longestSpin, spin)
    }

    func turns(on today: String) -> Double {
        day == today ? turnsToday : 0
    }

    static func label(turns: Double) -> String {
        let count = Int(turns)
        return count == 1 ? "1 turn" : "\(count) turns"
    }
}

struct PetRecord: Codable, Equatable {
    let selection: PetSelection
    let name: String
    let layoutId: String
}

enum PerchStorage {
    private static let preferencesKey = "perchPreferences"
    private static let statsKey = "perchStats"
    private static let recordKey = "perchPet"
    private static let sheetFile = "perch-pet.sheet"

    private static var defaults: UserDefaults? {
        UserDefaults(suiteName: WidgetSnapshotStore.appGroup)
    }

    private static var sheetURL: URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: WidgetSnapshotStore.appGroup)?
            .appendingPathComponent(sheetFile)
    }

    private static func read<Value: Decodable>(_ type: Value.Type, key: String) -> Value? {
        defaults?.data(forKey: key).flatMap { try? JSONDecoder().decode(type, from: $0) }
    }

    private static func write<Value: Encodable>(_ value: Value, key: String) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        defaults?.set(data, forKey: key)
    }

    static var preferences: PerchPreferences {
        get { read(PerchPreferences.self, key: preferencesKey) ?? PerchPreferences() }
        set { write(newValue, key: preferencesKey) }
    }

    static var stats: PerchStats {
        get { read(PerchStats.self, key: statsKey) ?? PerchStats() }
        set { write(newValue, key: statsKey) }
    }

    static func merge(_ incoming: PerchPreferences) {
        preferences = preferences.merged(with: incoming)
    }

    static func cachedPet() -> (record: PetRecord, sheet: Data)? {
        guard let record = read(PetRecord.self, key: recordKey),
              let url = sheetURL,
              let sheet = try? Data(contentsOf: url) else {
            return nil
        }
        return (record, sheet)
    }

    static func cache(_ record: PetRecord, sheet: Data) {
        guard let url = sheetURL, (try? sheet.write(to: url, options: .atomic)) != nil else { return }
        write(record, key: recordKey)
    }

    static func clear() {
        [preferencesKey, statsKey, recordKey].forEach { defaults?.removeObject(forKey: $0) }
        if let url = sheetURL {
            try? FileManager.default.removeItem(at: url)
        }
        PetPoseStore.clear()
        WidgetCenter.shared.reloadAllTimelines()
    }
}

extension Notification.Name {
    static let perchChanged = Notification.Name("perchChanged")
}
