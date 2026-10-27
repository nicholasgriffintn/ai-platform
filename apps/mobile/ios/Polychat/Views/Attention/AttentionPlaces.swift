import Foundation

enum AttentionEntry: Identifiable {
    case decision(WorkInboxItem)
    case attention(WorkAttentionItem)
    case notification(TaskInboxItem)

    var id: String {
        switch self {
        case .decision(let item): return "decision:\(item.id)"
        case .attention(let item): return "attention:\(item.id)"
        case .notification(let item): return "notification:\(item.id)"
        }
    }

    var workspaceId: String? {
        switch self {
        case .decision(let item): return item.workspaceId
        case .attention(let item): return item.workspaceId
        case .notification(let item): return item.workspaceId
        }
    }

    var projectId: String? {
        switch self {
        case .decision(let item): return item.projectId
        case .attention(let item): return item.projectId
        case .notification(let item): return item.projectId
        }
    }

    var since: String {
        switch self {
        case .decision(let item): return item.since
        case .attention(let item): return item.occurredAt
        case .notification(let item): return item.since
        }
    }

    var needsAction: Bool {
        switch self {
        case .decision: return true
        case .attention(let item): return item.needsAction
        case .notification(let item): return item.requiresAction
        }
    }
}

struct AttentionPlace: Identifiable {
    let id: String
    let title: String
    let entries: [AttentionEntry]

    var needsYouCount: Int {
        entries.filter(\.needsAction).count
    }
}

enum AttentionPlaces {
    static func group(
        decisions: [WorkInboxItem],
        workItems: [WorkAttentionItem],
        notifications: [TaskInboxItem],
        workspaceNames: [String: String]
    ) -> [AttentionPlace] {
        var projectNames: [String: String] = [:]
        var names = workspaceNames
        for item in workItems {
            projectNames[item.projectId] = item.projectName
            names[item.workspaceId] = names[item.workspaceId] ?? item.workspaceName
        }
        for item in notifications {
            projectNames[item.projectId] = item.projectName
        }

        let entries = (decisions.map(AttentionEntry.decision)
            + workItems.map(AttentionEntry.attention)
            + notifications.map(AttentionEntry.notification))
            .sorted { left, right in
                if left.needsAction != right.needsAction { return left.needsAction }
                return left.since > right.since
            }

        var order: [String] = []
        var grouped: [String: [AttentionEntry]] = [:]
        for entry in entries {
            let key = placeKey(entry)
            if grouped[key] == nil {
                order.append(key)
            }
            grouped[key, default: []].append(entry)
        }

        let places = order.compactMap { key -> AttentionPlace? in
            guard let placeEntries = grouped[key], let first = placeEntries.first else { return nil }
            return AttentionPlace(
                id: key,
                title: title(for: first, workspaceNames: names, projectNames: projectNames),
                entries: placeEntries
            )
        }

        return places.filter { $0.id == personalKey } + places.filter { $0.id != personalKey }
    }

    private static let personalKey = "personal"

    private static func placeKey(_ entry: AttentionEntry) -> String {
        guard let workspaceId = entry.workspaceId else { return personalKey }
        return "\(workspaceId):\(entry.projectId ?? "")"
    }

    private static func title(
        for entry: AttentionEntry,
        workspaceNames: [String: String],
        projectNames: [String: String]
    ) -> String {
        guard let workspaceId = entry.workspaceId else { return "Personal" }
        let workspace = workspaceNames[workspaceId] ?? "Workspace"
        guard let projectId = entry.projectId else { return workspace }
        return "\(workspace) · \(projectNames[projectId] ?? "Project")"
    }
}
