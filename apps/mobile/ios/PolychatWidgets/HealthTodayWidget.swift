import SwiftUI
import WidgetKit

struct HealthEntry: TimelineEntry {
    let date: Date
    let health: WidgetSnapshot.Health?
}

struct HealthProvider: TimelineProvider {
    func placeholder(in context: Context) -> HealthEntry {
        HealthEntry(date: .now, health: .preview)
    }

    func getSnapshot(in context: Context, completion: @escaping (HealthEntry) -> Void) {
        let health = WidgetSnapshotStore.read().health
        completion(HealthEntry(date: .now, health: context.isPreview && health == nil ? .preview : health))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HealthEntry>) -> Void) {
        let entry = HealthEntry(date: .now, health: WidgetSnapshotStore.read().health)
        completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(30 * 60))))
    }
}

struct HealthTodayWidgetView: View {
    let entry: HealthEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        content
            .widgetURL(URL(string: "polychat://discover"))
            .containerBackground(.fill.tertiary, for: .widget)
    }

    @ViewBuilder
    private var content: some View {
        if let health = entry.health {
            switch family {
            case .accessoryCircular:
                VStack(spacing: 0) {
                    Image(systemName: "figure.walk").font(.caption)
                    Text(health.steps.map { $0 >= 1000 ? "\($0 / 1000)k" : "\($0)" } ?? "–").font(.headline)
                }
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 2) {
                    Label(health.vitalsNote ?? "Health", systemImage: health.needsAttention ? "heart.text.square.fill" : "heart.fill")
                        .font(.caption.weight(.semibold))
                        .lineLimit(1)
                    Text(health.summary ?? "No data yet").font(.caption2).lineLimit(2)
                }
            default:
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Health").font(.system(.headline, design: .serif))
                        Spacer()
                        Image(systemName: "heart.fill").foregroundStyle(health.needsAttention ? .orange : .pink)
                    }
                    let metrics = HealthMetric.list(health)
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), alignment: .leading), count: family == .systemSmall ? 1 : 2), alignment: .leading, spacing: 6) {
                        ForEach(metrics.prefix(family == .systemSmall ? 3 : 4), id: \.label) { metric in
                            VStack(alignment: .leading, spacing: 0) {
                                Text(metric.value).font(.subheadline.weight(.semibold)).lineLimit(1)
                                Text(metric.label).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                            }
                        }
                    }
                    Spacer(minLength: 0)
                    if let note = health.vitalsNote {
                        Text(note)
                            .font(.caption2)
                            .foregroundStyle(health.needsAttention ? Color.orange : Color.secondary)
                            .lineLimit(2)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        } else {
            VStack(alignment: .leading, spacing: 6) {
                Text("Health").font(.system(.headline, design: .serif))
                Text("Turn on Apple Health in Polychat Settings.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct HealthMetric {
    let label: String
    let value: String

    static func list(_ health: WidgetSnapshot.Health) -> [HealthMetric] {
        [
            health.sleepMinutes.map { HealthMetric(label: "Sleep", value: "\($0 / 60)h \($0 % 60)m") },
            health.steps.map { HealthMetric(label: "Steps", value: $0.formatted()) },
            health.restingHeartRate.map { HealthMetric(label: "Resting HR", value: "\($0) bpm") },
            health.heartRateVariability.map { HealthMetric(label: "HRV", value: "\($0) ms") }
        ].compactMap { $0 }
    }
}

extension WidgetSnapshot.Health {
    static let preview = WidgetSnapshot.Health(
        sleepMinutes: 432, steps: 6240, restingHeartRate: 56, restingHeartRateUsual: 57,
        heartRateVariability: 44, heartRateVariabilityUsual: 46, observedAt: .now
    )
}

struct HealthTodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "HealthToday", provider: HealthProvider()) { entry in
            HealthTodayWidgetView(entry: entry)
        }
        .configurationDisplayName("Health")
        .description("Sleep, steps, resting heart rate and heart rate variability against your usual.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryCircular])
    }
}
