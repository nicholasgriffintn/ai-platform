import WidgetKit

enum NowItem: Hashable {
    case event(NowEvent)
    case line(WidgetSnapshot.Line)
    case health(WidgetSnapshot.Health)
}

struct NowEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot
    let events: [NowEvent]

    var greeting: String { snapshot.today?.greeting ?? "Today" }

    var items: [NowItem] {
        NowRanking.items(snapshot: snapshot, events: events, at: date)
    }

    var cards: [WidgetSnapshot.Line] {
        (snapshot.today?.cards ?? []).filter { $0.expiresAt.map { $0 > date } ?? true }
    }

    var relevance: TimelineEntryRelevance? {
        let disrupted = items.contains { item in
            if case .line(let line) = item { return NowRanking.isDisruption(line) }
            return false
        }
        let soon = events.first.map { $0.start.timeIntervalSince(date) < 30 * 60 } ?? false
        return TimelineEntryRelevance(score: disrupted ? 80 : soon ? 60 : snapshot.needsYou > 0 ? 50 : 10)
    }
}

enum NowRanking {
    private static let healthLifetime: TimeInterval = 18 * 60 * 60

    static func isDisruption(_ line: WidgetSnapshot.Line) -> Bool {
        line.kind == "travel" || (line.kind == "lines" && line.detail != "Good service")
    }

    static func items(snapshot: WidgetSnapshot, events: [NowEvent], at date: Date) -> [NowItem] {
        let upcoming = events.filter { $0.end > date }
        let brief = (snapshot.today?.brief ?? [])
            .filter { $0.expiresAt.map { $0 > date } ?? true }
            .filter { upcoming.isEmpty || $0.kind != "calendar" }
        let health = snapshot.health.flatMap { -$0.observedAt.timeIntervalSince(date) < healthLifetime ? $0 : nil }
        let disruptions = brief.filter(isDisruption)
        let priorities = brief.filter { $0.kind == "priority" }
        let goodService = brief.filter { $0.kind == "lines" && !isDisruption($0) }
        let rest = brief.filter { !isDisruption($0) && $0.kind != "priority" && $0.kind != "lines" }

        var items: [NowItem] = upcoming.prefix(1).map(NowItem.event)
        items += disruptions.map(NowItem.line)
        if let health, health.needsAttention { items.append(.health(health)) }
        items += priorities.map(NowItem.line)
        items += upcoming.dropFirst().prefix(1).map(NowItem.event)
        if let health, !health.needsAttention, health.summary != nil { items.append(.health(health)) }
        items += rest.map(NowItem.line)
        items += goodService.map(NowItem.line)
        return items
    }
}

struct NowProvider: TimelineProvider {
    func placeholder(in context: Context) -> NowEntry {
        NowEntry(date: .now, snapshot: .preview, events: NowEvent.preview)
    }

    func getSnapshot(in context: Context, completion: @escaping (NowEntry) -> Void) {
        let snapshot = WidgetSnapshotStore.read()
        let preview = context.isPreview && snapshot == .empty
        completion(NowEntry(date: .now, snapshot: preview ? .preview : snapshot, events: preview ? NowEvent.preview : NowCalendar.upcoming()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NowEntry>) -> Void) {
        let now = Date()
        let snapshot = WidgetSnapshotStore.read()
        let events = NowCalendar.upcoming(now: now)
        let horizon = now.addingTimeInterval(30 * 60)
        let expiries = ((snapshot.today?.brief ?? []) + (snapshot.today?.cards ?? [])).compactMap(\.expiresAt)
        let boundaries = events.flatMap { [$0.start, $0.end] } + expiries
        let dates = Set(boundaries.filter { $0 > now && $0 < horizon })
        let entries = ([now] + dates.sorted()).map { NowEntry(date: $0, snapshot: snapshot, events: events) }
        completion(Timeline(entries: entries, policy: .after(horizon)))
    }
}

extension NowEvent {
    static let preview = [
        NowEvent(title: "Design review", start: .now.addingTimeInterval(25 * 60), end: .now.addingTimeInterval(55 * 60), location: "Room 4"),
        NowEvent(title: "Lunch with Sam", start: .now.addingTimeInterval(3 * 60 * 60), end: .now.addingTimeInterval(4 * 60 * 60), location: nil)
    ]
}
