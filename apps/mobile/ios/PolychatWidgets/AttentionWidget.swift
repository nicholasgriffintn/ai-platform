import SwiftUI
import WidgetKit

struct AttentionWidgetView: View {
    let entry: SnapshotEntry
    @Environment(\.widgetFamily) private var family

    private var attention: WidgetSnapshot.Attention {
        entry.snapshot.attention ?? WidgetSnapshot.Attention(needsYou: 0, running: 0, items: [])
    }

    private var headline: String {
        attention.needsYou > 0
            ? "\(attention.needsYou) waiting on you"
            : attention.running > 0 ? "\(attention.running) running" : "All clear"
    }

    var body: some View {
        content
            .widgetURL(URL(string: "polychat://attention"))
            .containerBackground(.fill.tertiary, for: .widget)
    }

    @ViewBuilder
    private var content: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 0) {
                    Text("\(attention.needsYou)").font(.title2.weight(.bold))
                    Image(systemName: "bell").font(.caption2)
                }
            }
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                Text(headline).font(.headline).lineLimit(1)
                Text(attention.items.first?.title ?? "Nothing needs you right now.")
                    .font(.caption)
                    .lineLimit(2)
            }
        case .accessoryInline:
            Label(headline, systemImage: "bell")
        case .systemSmall:
            VStack(alignment: .leading, spacing: 4) {
                Image(systemName: attention.needsYou > 0 ? "bell.badge.fill" : "bell")
                    .foregroundStyle(attention.needsYou > 0 ? .orange : .secondary)
                Spacer(minLength: 0)
                Text("\(attention.needsYou)")
                    .font(.system(size: 40, weight: .bold, design: .rounded))
                Text(attention.needsYou == 1 ? "thing needs you" : "things need you")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if attention.running > 0 {
                    Text("\(attention.running) running")
                        .font(.caption2)
                        .foregroundStyle(.tint)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        default:
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Attention").font(.headline)
                    Spacer()
                    Text(headline).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                }
                if attention.items.isEmpty {
                    WidgetEmptyText(text: "Approvals, questions and running work show up here.")
                } else {
                    ForEach(attention.items.prefix(family == .systemLarge ? 5 : 2), id: \.self) { item in
                        WidgetLineView(line: item)
                    }
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct AttentionWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "Attention", provider: SnapshotProvider()) { entry in
            AttentionWidgetView(entry: entry)
        }
        .configurationDisplayName("Attention")
        .description("What's waiting on you and what's running.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}
