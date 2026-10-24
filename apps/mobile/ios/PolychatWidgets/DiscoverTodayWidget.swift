import SwiftUI
import WidgetKit

private let discoverURL = URL(string: "polychat://discover")!

struct DiscoverTodayEntry: TimelineEntry {
    let date: Date
}

struct DiscoverTodayProvider: TimelineProvider {
    func placeholder(in context: Context) -> DiscoverTodayEntry {
        DiscoverTodayEntry(date: .now)
    }

    func getSnapshot(in context: Context, completion: @escaping (DiscoverTodayEntry) -> Void) {
        completion(DiscoverTodayEntry(date: .now))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DiscoverTodayEntry>) -> Void) {
        let tomorrow = Calendar.current.nextDate(
            after: .now,
            matching: DateComponents(hour: 7, minute: 5),
            matchingPolicy: .nextTime
        ) ?? .now.addingTimeInterval(86_400)
        completion(Timeline(entries: [DiscoverTodayEntry(date: .now)], policy: .after(tomorrow)))
    }
}

struct DiscoverTodayWidgetView: View {
    let entry: DiscoverTodayEntry
    @Environment(\.widgetFamily) private var family

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: entry.date)
        return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
    }

    var body: some View {
        Group {
            switch family {
            case .accessoryCircular:
                Image(systemName: "sunrise.fill").font(.title2)
            default:
                VStack(alignment: .leading, spacing: 6) {
                    Image(systemName: "sunrise.fill")
                        .font(.title2)
                        .foregroundStyle(.orange)
                    Spacer(minLength: 0)
                    Text(greeting)
                        .font(.system(.headline, design: .serif))
                    Text("Today's edition is on the perch.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .widgetURL(discoverURL)
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

struct DiscoverTodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "DiscoverToday", provider: DiscoverTodayProvider()) { entry in
            DiscoverTodayWidgetView(entry: entry)
        }
        .configurationDisplayName("Today")
        .description("Open today's Discover edition.")
        .supportedFamilies([.systemSmall, .accessoryCircular])
    }
}
