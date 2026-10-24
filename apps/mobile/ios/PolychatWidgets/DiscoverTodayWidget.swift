import SwiftUI
import WidgetKit

struct DiscoverTodayWidgetView: View {
    let entry: SnapshotEntry
    @Environment(\.widgetFamily) private var family

    private var today: WidgetSnapshot.Today? {
        entry.snapshot.today
    }

    var body: some View {
        content
            .widgetURL(URL(string: "polychat://discover"))
            .containerBackground(.fill.tertiary, for: .widget)
    }

    @ViewBuilder
    private var content: some View {
        switch family {
        case .accessoryCircular:
            Image(systemName: "sun.horizon.fill").font(.title2)
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                Text(today?.greeting ?? "Discover").font(.headline).lineLimit(1)
                Text(today?.brief.first?.title ?? "Your edition arrives each morning.")
                    .font(.caption)
                    .lineLimit(2)
            }
        case .systemSmall:
            VStack(alignment: .leading, spacing: 6) {
                Image(systemName: "sun.horizon.fill").foregroundStyle(.orange)
                Text(today?.greeting ?? "Discover")
                    .font(.system(.headline, design: .serif))
                    .lineLimit(2)
                Spacer(minLength: 0)
                Text(today?.brief.first?.title ?? today?.cards.first?.title ?? "Your edition arrives each morning.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        default:
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(today?.greeting ?? "Discover")
                        .font(.system(.headline, design: .serif))
                    Spacer()
                    Image(systemName: "sun.horizon.fill").foregroundStyle(.orange)
                }
                if let today {
                    ForEach(today.brief.prefix(family == .systemLarge ? 4 : 2), id: \.self) { line in
                        WidgetLineView(line: line)
                    }
                    if family == .systemLarge && !today.cards.isEmpty {
                        Divider()
                        Text("Worth a look").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                        ForEach(today.cards.prefix(3), id: \.self) { card in
                            WidgetLineView(line: card)
                        }
                    }
                } else {
                    WidgetEmptyText(text: "Open Polychat to load today's edition.")
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct DiscoverTodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "DiscoverToday", provider: SnapshotProvider()) { entry in
            DiscoverTodayWidgetView(entry: entry)
        }
        .configurationDisplayName("Today")
        .description("Your Discover brief and what's worth a look.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular, .accessoryCircular])
    }
}
