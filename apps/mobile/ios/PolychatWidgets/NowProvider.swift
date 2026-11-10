import WidgetKit

enum NowItem: Hashable {
    case event(WidgetSnapshot.Line)
    case line(WidgetSnapshot.Line)
    case health(WidgetSnapshot.Health)
}

struct NowEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot

    var greeting: String { snapshot.today?.greeting ?? "Today" }

    var items: [NowItem] {
        NowRanking.items(snapshot: snapshot, at: date)
    }

    var cards: [WidgetSnapshot.Line] {
        (snapshot.today?.cards ?? []).filter { $0.expiresAt.map { $0 > date } ?? true }
    }

    var relevance: TimelineEntryRelevance? {
        let current = items
        let disrupted = current.contains { item in
            if case .line(let line) = item { return NowRanking.isDisruption(line) }
            return false
        }
        let soon = current.contains { item in
            if case .event(let event) = item, let start = event.startsAt { return start.timeIntervalSince(date) < 30 * 60 }
            return false
        }
        return TimelineEntryRelevance(score: disrupted ? 80 : soon ? 60 : snapshot.needsYou > 0 ? 50 : 10)
    }
}

enum NowRanking {
    private static let healthLifetime: TimeInterval = 18 * 60 * 60

    static func isDisruption(_ line: WidgetSnapshot.Line) -> Bool {
        line.kind == "travel" || (line.kind == "lines" && line.detail != "Good service")
    }

    static func items(snapshot: WidgetSnapshot, at date: Date) -> [NowItem] {
        let brief = (snapshot.today?.brief ?? []).filter { line in
            (line.expiresAt.map { $0 > date } ?? true) && (line.endsAt.map { $0 > date } ?? true)
        }
        let isEvent: (WidgetSnapshot.Line) -> Bool = { $0.kind == "calendar" && $0.startsAt != nil }
        let events = brief.filter(isEvent)
        let health = snapshot.health.flatMap { date.timeIntervalSince($0.observedAt) < healthLifetime ? $0 : nil }
        let disruptions = brief.filter(isDisruption)
        let priorities = brief.filter { $0.kind == "priority" }
        let goodService = brief.filter { $0.kind == "lines" && !isDisruption($0) }
        let rest = brief.filter { !isDisruption($0) && !isEvent($0) && $0.kind != "priority" && $0.kind != "lines" }

        var items: [NowItem] = events.prefix(1).map(NowItem.event)
        items += disruptions.map(NowItem.line)
        if let health, health.needsAttention { items.append(.health(health)) }
        items += priorities.map(NowItem.line)
        items += events.dropFirst().prefix(1).map(NowItem.event)
        if let health, !health.needsAttention, health.summary != nil { items.append(.health(health)) }
        items += rest.map(NowItem.line)
        items += goodService.map(NowItem.line)
        return items
    }
}

struct NowProvider: TimelineProvider {
    func placeholder(in context: Context) -> NowEntry {
        NowEntry(date: .now, snapshot: .preview)
    }

    func getSnapshot(in context: Context, completion: @escaping (NowEntry) -> Void) {
        let snapshot = WidgetSnapshotStore.read()
        completion(NowEntry(date: .now, snapshot: context.isPreview && snapshot == .empty ? .preview : snapshot))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NowEntry>) -> Void) {
        let now = Date()
        let snapshot = WidgetSnapshotStore.read()
        let dayAhead = now.addingTimeInterval(24 * 60 * 60)
        let lines = (snapshot.today?.brief ?? []) + (snapshot.today?.cards ?? [])
        let boundaries = lines.flatMap { [$0.startsAt, $0.endsAt, $0.expiresAt].compactMap { $0 } }
        let dates = Set(boundaries.filter { $0 > now && $0 < dayAhead }).sorted().prefix(48)
        let entries = ([now] + dates).map { NowEntry(date: $0, snapshot: snapshot) }
        completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(20 * 60))))
    }
}
