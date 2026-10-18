import SwiftUI
import WidgetKit

private let polyURL = URL(string: "polychat://poly")!

struct AskPolyEntry: TimelineEntry {
    let date: Date
}

struct AskPolyProvider: TimelineProvider {
    func placeholder(in context: Context) -> AskPolyEntry {
        AskPolyEntry(date: .now)
    }

    func getSnapshot(in context: Context, completion: @escaping (AskPolyEntry) -> Void) {
        completion(AskPolyEntry(date: .now))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<AskPolyEntry>) -> Void) {
        completion(Timeline(entries: [AskPolyEntry(date: .now)], policy: .never))
    }
}

struct AskPolyWidgetView: View {
    @Environment(\.widgetFamily) private var family

    var body: some View {
        Group {
            switch family {
            case .accessoryCircular:
                PolyGlyph(mood: "idle", size: 34)
            default:
                VStack(alignment: .leading, spacing: 8) {
                    PolyGlyph(mood: "idle", size: 44)
                    Spacer(minLength: 0)
                    Text("Ask Poly")
                        .font(.headline)
                    Text("Find, tidy or hand something off.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .widgetURL(polyURL)
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

struct AskPolyWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AskPoly", provider: AskPolyProvider()) { _ in
            AskPolyWidgetView()
        }
        .configurationDisplayName("Ask Poly")
        .description("Open Poly from your home or lock screen.")
        .supportedFamilies([.systemSmall, .accessoryCircular])
    }
}
