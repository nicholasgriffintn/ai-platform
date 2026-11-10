import SwiftUI
import WidgetKit

struct DiscoverTodayWidgetView: View {
    let entry: NowEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        content
            .widgetURL(URL(string: "polychat://discover"))
            .containerBackground(.fill.tertiary, for: .widget)
    }

    @ViewBuilder
    private var content: some View {
        let items = entry.items
        switch family {
        case .accessoryCircular:
            Image(systemName: "sun.horizon.fill").font(.title2)
        case .accessoryRectangular:
            if let first = items.first {
                NowItemView(item: first, date: entry.date, compact: true)
            } else {
                Text(entry.greeting).font(.headline).lineLimit(1)
            }
        case .systemSmall:
            VStack(alignment: .leading, spacing: 6) {
                Text(entry.greeting)
                    .font(.system(.subheadline, design: .serif).weight(.semibold))
                    .lineLimit(1)
                ForEach(Array(items.prefix(2).enumerated()), id: \.offset) { _, item in
                    NowItemView(item: item, date: entry.date, compact: true)
                }
                if items.isEmpty {
                    WidgetEmptyText(text: "Open Polychat to load today.")
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        default:
            let limit = family == .systemLarge ? 6 : 3
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(entry.greeting)
                        .font(.system(.headline, design: .serif))
                        .lineLimit(1)
                    Spacer()
                    if entry.snapshot.needsYou > 0 {
                        Label("\(entry.snapshot.needsYou)", systemImage: "bell.badge.fill")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.orange)
                    } else {
                        Image(systemName: "sun.horizon.fill").foregroundStyle(.orange)
                    }
                }
                ForEach(Array(items.prefix(limit).enumerated()), id: \.offset) { _, item in
                    NowItemView(item: item, date: entry.date, compact: false)
                }
                if items.isEmpty {
                    if entry.cards.isEmpty {
                        WidgetEmptyText(text: "Open Polychat to load today's edition.")
                    } else {
                        ForEach(entry.cards.prefix(2), id: \.self) { WidgetLineView(line: $0) }
                    }
                }
                if family == .systemLarge && !items.isEmpty && !entry.cards.isEmpty {
                    Divider()
                    Text("Worth a look").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                    ForEach(entry.cards.prefix(max(1, 8 - min(items.count, limit))), id: \.self) { card in
                        WidgetLineView(line: card)
                    }
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct NowItemView: View {
    let item: NowItem
    let date: Date
    let compact: Bool

    var body: some View {
        switch item {
        case .event(let event):
            row(systemImage: "calendar", tint: .red, title: Text(event.title), detail: eventDetail(event))
        case .line(let line):
            row(
                systemImage: line.systemImage,
                tint: NowRanking.isDisruption(line) ? .orange : .accentColor,
                title: Text(line.title),
                detail: line.detail.map { Text($0) }
            )
        case .health(let health):
            row(
                systemImage: health.needsAttention ? "heart.text.square.fill" : "heart.fill",
                tint: health.needsAttention ? .orange : .pink,
                title: Text(health.needsAttention ? (health.vitalsNote ?? "Vitals") : (health.summary ?? "Health")),
                detail: (health.needsAttention ? health.summary : health.vitalsNote).map { Text($0) }
            )
        }
    }

    private func eventDetail(_ event: WidgetSnapshot.Line) -> Text? {
        guard let start = event.startsAt, let end = event.endsAt else { return event.detail.map { Text($0) } }
        if start <= date {
            return Text("Now until \(end, style: .time)")
        }
        if start.timeIntervalSince(date) < 60 * 60 {
            return Text("In \(start, style: .relative)")
        }
        return Text("\(start, style: .time)–\(end, style: .time)")
    }

    private func row(systemImage: String, tint: Color, title: Text, detail: Text?) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: systemImage)
                .font(.caption)
                .foregroundStyle(tint)
                .frame(width: 14)
                .widgetAccentable()
            VStack(alignment: .leading, spacing: 1) {
                title
                    .font(.caption.weight(.medium))
                    .lineLimit(compact ? 1 : 2)
                if let detail {
                    detail
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
        }
    }
}

struct DiscoverTodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "DiscoverToday", provider: NowProvider()) { entry in
            DiscoverTodayWidgetView(entry: entry)
        }
        .configurationDisplayName("Today")
        .description("Your next event, line status, health and what matters now.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular, .accessoryCircular])
    }
}
