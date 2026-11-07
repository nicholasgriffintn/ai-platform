import SwiftUI
import WidgetKit

private struct PerchComplicationView: View {
    @Environment(\.widgetFamily) private var family
    let snapshot: WidgetSnapshot

    private var label: String {
        snapshot.needsYou > 0 ? "\(snapshot.needsYou) need you" : snapshot.running > 0 ? "\(snapshot.running) in flight" : "All quiet"
    }

    var body: some View {
        switch family {
        case .accessoryCorner:
            PetPoseWidgetImage(pose: snapshot.pose(), size: 28)
                .widgetLabel(label)
        default:
            ZStack(alignment: .topTrailing) {
                AccessoryWidgetBackground()
                PetPoseWidgetImage(pose: snapshot.pose(), size: 38)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                if snapshot.needsYou > 0 {
                    Text("\(snapshot.needsYou)")
                        .font(.caption2.weight(.bold).monospacedDigit())
                        .padding(.horizontal, 4)
                        .background(.orange, in: Capsule())
                        .widgetAccentable()
                }
            }
        }
    }
}

struct PerchComplication: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "PerchComplication", provider: SnapshotProvider()) { entry in
            PerchComplicationView(snapshot: entry.snapshot)
                .containerBackground(.fill.tertiary, for: .widget)
                .widgetURL(URL(string: "polychat://perch"))
        }
        .configurationDisplayName("Your pet")
        .description("Your pet, showing what Polychat is up to. Tap to play.")
        .supportedFamilies([.accessoryCircular, .accessoryCorner])
    }
}
