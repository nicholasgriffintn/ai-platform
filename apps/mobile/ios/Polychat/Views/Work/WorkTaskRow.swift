import SwiftUI

struct WorkTaskRow: View {
    @EnvironmentObject private var teammatesStore: TeammatesStore
    let task: ProjectTask
    var showsProject: String?

    private var tint: Color { WorkTaskPresentation.tint(task) }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Group {
                if task.status == "running" {
                    ProgressView().controlSize(.small)
                } else {
                    Image(systemName: WorkTaskPresentation.icon(task))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(tint)
                }
            }
            .frame(width: 30, height: 30)
            .background(tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 8, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                Text(task.objective)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Color.polychat.text)
                    .lineLimit(2)
                if let detail = task.blockedDetail, !detail.isEmpty, task.status == "blocked" {
                    Text(detail)
                        .font(.footnote)
                        .foregroundStyle(Color.polychat.textMuted)
                        .lineLimit(2)
                }
                HStack(spacing: 6) {
                    StatusPill(label: WorkTaskPresentation.statusLabel(task), tint: tint)
                    Text(meta)
                        .font(.caption)
                        .foregroundStyle(Color.polychat.textMuted)
                        .lineLimit(1)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private var meta: String {
        [showsProject, task.key, ownerName, RelativeTime.label(for: task.updatedAt ?? task.createdAt)]
            .compactMap { $0 }
            .joined(separator: " · ")
    }

    private var ownerName: String? {
        guard case .teammate(let id) = task.owner else { return nil }
        return teammatesStore.teammates.first { $0.id == id }?.name
    }
}
