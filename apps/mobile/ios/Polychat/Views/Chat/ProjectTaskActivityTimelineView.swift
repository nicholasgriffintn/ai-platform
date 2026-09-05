import SwiftUI

struct ProjectTaskActivityTimelineView: View {
    let timeline: ProjectTaskActivityTimeline
    @State private var isExpanded = false

    private var visibleItems: [ProjectTaskActivityItem] {
        if isExpanded {
            return timeline.items
        }

        let priority = timeline.items.filter { $0.actionable || $0.terminal }
        let recent = Array(timeline.items.prefix(3))
        var seen = Set<String>()
        return (priority + recent).filter { seen.insert($0.id).inserted }.prefix(5).map { $0 }
    }

    var body: some View {
        if !timeline.items.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Task activity")
                        .font(.headline)
                    Spacer()
                    if timeline.items.count > visibleItems.count || isExpanded {
                        Button(isExpanded ? "Show less" : "Show all") {
                            isExpanded.toggle()
                        }
                        .font(.caption.weight(.semibold))
                    }
                }

                ForEach(visibleItems) { item in
                    ProjectTaskActivityRow(item: item)
                }
            }
            .padding(14)
            .background(Color.polychat.elevatedBackground)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(Color.polychat.border, lineWidth: 1)
            )
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Task activity timeline")
        }
    }
}

private struct ProjectTaskActivityRow: View {
    let item: ProjectTaskActivityItem
    @State private var showsDetail = false

    private var presentation: ProjectTaskActivityPresentation {
        ProjectTaskActivityPresentation.resolve(item)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Button {
                if item.detail != nil || !item.items.isEmpty {
                    showsDetail.toggle()
                }
            } label: {
                HStack(alignment: .top, spacing: 9) {
                    Image(systemName: presentation.systemImage)
                        .foregroundStyle(colour)
                        .frame(width: 18)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.title)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.primary)
                        Text(presentation.statusLabel)
                            .font(.caption)
                            .foregroundStyle(item.actionable ? Color.orange : Color.secondary)
                        Text(metadataLabel)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    if item.detail != nil || !item.items.isEmpty {
                        Image(systemName: showsDetail ? "chevron.up" : "chevron.down")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(item.title), \(presentation.statusLabel), \(metadataLabel)")
            .accessibilityHint(
                item.detail != nil || !item.items.isEmpty ? "Double tap to show details" : ""
            )

            if showsDetail {
                if let detail = item.detail {
                    Text(detail)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                ForEach(Array(item.items.enumerated()), id: \.offset) { _, detail in
                    Text("• \(detail)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 3)
    }

    private var colour: Color {
        switch presentation.tone {
        case .active:
            return .blue
        case .attention:
            return .orange
        case .danger:
            return .red
        case .neutral:
            return .secondary
        case .success:
            return .green
        }
    }

    private var metadataLabel: String {
        let date = AppDateParser.parse(item.occurredAt)?.formatted(
            date: .abbreviated,
            time: .shortened
        ) ?? item.occurredAt

        if let runId = item.runId {
            return "\(date) · Run \(runId.prefix(8))"
        }

        return "\(date) · Proposed plan"
    }
}
