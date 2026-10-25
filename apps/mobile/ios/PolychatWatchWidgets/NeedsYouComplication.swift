import SwiftUI
import WidgetKit

private struct NeedsYouView: View {
    @Environment(\.widgetFamily) private var family
    let snapshot: WidgetSnapshot

    private var needsYou: Int { snapshot.attention?.needsYou ?? snapshot.poly?.needsYou ?? 0 }
    private var running: Int { snapshot.attention?.running ?? snapshot.poly?.workingOn ?? 0 }

    var body: some View {
        switch family {
        case .accessoryInline:
            Text(needsYou > 0 ? "\(needsYou) need you" : running > 0 ? "\(running) in flight" : "All quiet")
        case .accessoryCorner:
            PolyMark(size: 22)
                .widgetLabel(needsYou > 0 ? "\(needsYou) need you" : "All quiet")
        default:
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 0) {
                    Text("\(needsYou)")
                        .font(.title3.weight(.semibold))
                    Image(systemName: needsYou > 0 ? "exclamationmark.circle" : "checkmark")
                        .font(.caption2)
                }
            }
            .widgetAccentable()
        }
    }
}

struct NeedsYouComplication: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NeedsYouComplication", provider: SnapshotProvider()) { entry in
            NeedsYouView(snapshot: entry.snapshot)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Needs you")
        .description("How many approvals and questions are waiting.")
        .supportedFamilies([.accessoryCircular, .accessoryCorner, .accessoryInline])
    }
}
