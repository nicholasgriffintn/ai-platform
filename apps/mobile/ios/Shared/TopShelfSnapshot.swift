import Foundation

struct TopShelfSnapshot: Codable, Equatable {
    struct Item: Codable, Equatable {
        let id: String
        let title: String
        let imageFile: String?
        let link: String
    }

    var items: [Item] = []
}

enum TopShelfStore {
    private static let key = "topShelfSnapshot"
    private static let folder = "TopShelf"

    static func read() -> TopShelfSnapshot {
        guard let data = UserDefaults(suiteName: WidgetSnapshotStore.appGroup)?.data(forKey: key),
              let snapshot = try? JSONDecoder().decode(TopShelfSnapshot.self, from: data) else {
            return TopShelfSnapshot()
        }
        return snapshot
    }

    static func write(_ snapshot: TopShelfSnapshot) {
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        UserDefaults(suiteName: WidgetSnapshotStore.appGroup)?.set(data, forKey: key)
    }

    static func clear() {
        UserDefaults(suiteName: WidgetSnapshotStore.appGroup)?.removeObject(forKey: key)
        if let directory = imageDirectory() {
            try? FileManager.default.removeItem(at: directory)
        }
    }

    static func saveImage(_ data: Data, named name: String) -> String? {
        guard let directory = imageDirectory() else { return nil }
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_"))
        let safeName = String(String.UnicodeScalarView(name.unicodeScalars.filter(allowed.contains)))
        guard !safeName.isEmpty else { return nil }
        let file = "\(safeName).img"
        do {
            try data.write(to: directory.appendingPathComponent(file), options: .atomic)
            return file
        } catch {
            return nil
        }
    }

    static func imageURL(for file: String) -> URL? {
        imageDirectory()?.appendingPathComponent(file)
    }

    private static func imageDirectory() -> URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: WidgetSnapshotStore.appGroup)?
            .appendingPathComponent(folder, isDirectory: true)
    }
}
