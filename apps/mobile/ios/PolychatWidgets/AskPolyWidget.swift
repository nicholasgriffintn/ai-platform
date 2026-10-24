import SwiftUI
import WidgetKit

struct AskPolyWidgetView: View {
    let entry: SnapshotEntry
    @Environment(\.widgetFamily) private var family

    private var poly: WidgetSnapshot.Poly? {
        entry.snapshot.poly
    }

    var body: some View {
        content
            .widgetURL(URL(string: "polychat://poly"))
            .containerBackground(.fill.tertiary, for: .widget)
    }

    @ViewBuilder
    private var content: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                PolyMark(size: 30)
            }
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                Text("Poly").font(.headline)
                Text(poly?.status ?? "Ready when you are").font(.caption).lineLimit(2)
            }
        case .systemSmall:
            VStack(alignment: .leading, spacing: 6) {
                PolyMark(size: 40)
                Spacer(minLength: 0)
                Text(poly?.status ?? "Ready when you are")
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(2)
                Text(poly?.items.first?.title ?? "Tap to talk to Poly.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        default:
            HStack(alignment: .top, spacing: 12) {
                PolyMark(size: 48)
                VStack(alignment: .leading, spacing: 8) {
                    Text(poly?.status ?? "Ready when you are").font(.headline)
                    if let items = poly?.items, !items.isEmpty {
                        ForEach(items.prefix(3), id: \.self) { item in
                            WidgetLineView(line: item, showsDetail: false)
                        }
                    } else {
                        WidgetEmptyText(text: "Tap to pick up Poly's thread.")
                    }
                    Spacer(minLength: 0)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct AskPolyWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AskPoly", provider: SnapshotProvider()) { entry in
            AskPolyWidgetView(entry: entry)
        }
        .configurationDisplayName("Poly")
        .description("What Poly is working on, one tap from its thread.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular])
    }
}
