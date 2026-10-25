import SwiftUI
import WidgetKit

private struct PolyStatusView: View {
    let snapshot: WidgetSnapshot

    var body: some View {
        HStack(alignment: .top, spacing: 6) {
            PolyMark(size: 20)
            VStack(alignment: .leading, spacing: 2) {
                Text(snapshot.poly?.status ?? "Ready when you are")
                    .font(.headline)
                    .widgetAccentable()
                if let line = snapshot.attention?.items.first ?? snapshot.poly?.items.first {
                    Text(line.title)
                        .font(.caption)
                        .lineLimit(2)
                }
            }
            Spacer(minLength: 0)
        }
    }
}

struct PolyStatusComplication: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "PolyStatusComplication", provider: SnapshotProvider()) { entry in
            PolyStatusView(snapshot: entry.snapshot)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Poly")
        .description("What Poly is up to and the next thing that needs you.")
        .supportedFamilies([.accessoryRectangular])
    }
}
