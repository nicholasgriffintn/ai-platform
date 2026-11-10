import SwiftUI
import WidgetKit

struct TubeEntry: TimelineEntry {
    let date: Date
    let lines: [WidgetSnapshot.LineStatus]

    var disrupted: [WidgetSnapshot.LineStatus] { lines.filter(\.disrupted) }
}

struct TubeProvider: TimelineProvider {
    func placeholder(in context: Context) -> TubeEntry {
        TubeEntry(date: .now, lines: [])
    }

    func getSnapshot(in context: Context, completion: @escaping (TubeEntry) -> Void) {
        completion(TubeEntry(date: .now, lines: WidgetSnapshotStore.read().lines))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TubeEntry>) -> Void) {
        let entry = TubeEntry(date: .now, lines: WidgetSnapshotStore.read().lines)
        completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(15 * 60))))
    }
}

struct TubeStatusWidgetView: View {
    let entry: TubeEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        content
            .widgetURL(URL(string: "polychat://discover"))
            .containerBackground(.fill.tertiary, for: .widget)
    }

    @ViewBuilder
    private var content: some View {
        switch family {
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                Label("Tube", systemImage: "tram.fill").font(.headline)
                Text(summary).font(.caption).lineLimit(2)
            }
        case .accessoryInline:
            Text(summary)
        default:
            let limit = family == .systemLarge ? 14 : family == .systemMedium ? 6 : 4
            VStack(alignment: .leading, spacing: family == .systemSmall ? 4 : 6) {
                HStack {
                    Text("Line status").font(.system(.headline, design: .serif))
                    Spacer()
                    if let updatedAt = WidgetSnapshotStore.read().updatedAt {
                        Text(updatedAt, style: .time).font(.caption2).foregroundStyle(.secondary)
                    }
                }
                if entry.lines.isEmpty {
                    Text("Turn on Line status in Polychat, under Your day.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else if family == .systemMedium {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], alignment: .leading, spacing: 6) {
                        ForEach(entry.lines.prefix(limit), id: \.id) { TubeLineRow(line: $0, compact: true) }
                    }
                } else {
                    ForEach(entry.lines.prefix(limit), id: \.id) { line in
                        TubeLineRow(line: line, compact: family == .systemSmall)
                    }
                    if family == .systemLarge, let reason = entry.disrupted.first?.reason {
                        Text(reason).font(.caption2).foregroundStyle(.secondary).lineLimit(3)
                    }
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var summary: String {
        if entry.lines.isEmpty { return "No lines chosen" }
        let disrupted = entry.disrupted
        if disrupted.isEmpty { return "Good service on your lines" }
        return disrupted.prefix(2).map { "\($0.name): \($0.status)" }.joined(separator: " · ")
    }
}

private struct TubeLineRow: View {
    let line: WidgetSnapshot.LineStatus
    let compact: Bool

    var body: some View {
        HStack(spacing: 6) {
            RoundedRectangle(cornerRadius: 2)
                .fill(line.colour)
                .frame(width: 4, height: compact ? 22 : 26)
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 3) {
                    Text(line.name).font(.caption.weight(.semibold)).lineLimit(1)
                    if line.nearby { Image(systemName: "location.fill").font(.system(size: 7)).foregroundStyle(.secondary) }
                }
                Text(line.status)
                    .font(.caption2)
                    .foregroundStyle(line.disrupted ? Color.orange : Color.secondary)
                    .lineLimit(1)
            }
        }
    }
}

struct TubeStatusWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "TubeStatus", provider: TubeProvider()) { entry in
            TubeStatusWidgetView(entry: entry)
        }
        .configurationDisplayName("Line status")
        .description("TfL status for your lines and the lines near you, from Polychat.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular, .accessoryInline])
    }
}
