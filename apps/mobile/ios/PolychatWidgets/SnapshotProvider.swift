import WidgetKit

struct SnapshotEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot
}

struct SnapshotProvider: TimelineProvider {
    func placeholder(in context: Context) -> SnapshotEntry {
        SnapshotEntry(date: .now, snapshot: .preview)
    }

    func getSnapshot(in context: Context, completion: @escaping (SnapshotEntry) -> Void) {
        let snapshot = WidgetSnapshotStore.read()
        completion(SnapshotEntry(date: .now, snapshot: context.isPreview && snapshot == .empty ? .preview : snapshot))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SnapshotEntry>) -> Void) {
        let entry = SnapshotEntry(date: .now, snapshot: WidgetSnapshotStore.read())
        completion(Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(30 * 60))))
    }
}

extension WidgetSnapshot {
    static let preview = WidgetSnapshot(
        today: Today(
            date: "",
            greeting: "Good morning",
            brief: [
                Line(title: "Two approvals are waiting in Launch plan", detail: "Waiting on you", systemImage: "bell.badge"),
                Line(title: "Light rain after lunch", detail: "Weather", systemImage: "cloud.sun")
            ],
            cards: [
                Line(title: "What changed in the new SwiftUI scroll APIs", detail: "iOS", systemImage: "sparkles")
            ]
        ),
        attention: Attention(
            needsYou: 2,
            running: 1,
            items: [
                Line(title: "Approve the release notes", detail: "Launch plan", systemImage: "exclamationmark.circle"),
                Line(title: "Migrate the billing tables", detail: "Platform", systemImage: "bolt.horizontal")
            ]
        ),
        poly: Poly(
            status: "Working on 2 things",
            needsYou: 0,
            workingOn: 2,
            items: [Line(title: "Tidy this week's notes", detail: "running", systemImage: "circle.fill")]
        ),
        updatedAt: nil
    )
}
