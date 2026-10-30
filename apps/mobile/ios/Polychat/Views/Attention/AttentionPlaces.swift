import Foundation

enum InboxView: String, CaseIterable, Identifiable {
    case needsYou
    case updates
    case myTasks

    var id: String { rawValue }

    var title: String {
        switch self {
        case .needsYou: return "Needs you"
        case .updates: return "Updates"
        case .myTasks: return "My tasks"
        }
    }
}

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

    var isUnread: Bool {
        switch self {
        case .decision: return true
        case .attention(let item): return item.isUnread
        case .notification(let item): return !item.isRead
        }
    }
}

enum InboxDestination: Equatable {
    case task(projectId: String, taskId: String)
    case run(String)
    case conversation(String)
    case project(String)
    case web(String)

    static func of(_ item: WorkInboxItem) -> InboxDestination {
        if let projectId = item.projectId, let taskId = item.taskId {
            return .task(projectId: projectId, taskId: taskId)
        }
        if let conversationId = item.conversationId {
            return .conversation(conversationId)
        }
        if let projectId = item.projectId {
            return .project(projectId)
        }
        return .web(item.deepLink)
    }

    static func of(_ item: WorkAttentionItem) -> InboxDestination {
        if item.type == "run" {
            return .run(item.resourceId)
        }
        return .task(projectId: item.projectId, taskId: item.resourceId)
    }

    static func of(_ item: TaskInboxItem) -> InboxDestination {
        .task(projectId: item.projectId, taskId: item.taskId)
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
    static func entries(
        for view: InboxView,
        decisions: [WorkInboxItem],
        runs: [WorkAttentionItem],
        notifications: [TaskInboxItem]
    ) -> [AttentionEntry] {
        let needsYou = view == .needsYou
        let decisionEntries = needsYou ? decisions.map(AttentionEntry.decision) : []
        let runEntries = runs
            .filter { $0.type == "run" && $0.needsAction == needsYou }
            .map(AttentionEntry.attention)
        let notificationEntries = notifications
            .filter { $0.requiresAction == needsYou }
            .map(AttentionEntry.notification)

        return (decisionEntries + runEntries + notificationEntries).sorted { left, right in
            if left.isUnread != right.isUnread { return left.isUnread }
            return left.since > right.since
        }
    }

    static func group(
        _ entries: [AttentionEntry],
        workItems: [WorkAttentionItem],
        notifications: [TaskInboxItem],
        workspaceNames: [String: String],
        projectNames knownProjectNames: [String: String] = [:]
    ) -> [AttentionPlace] {
        var projectNames = knownProjectNames
        var names = workspaceNames
        for item in workItems {
            projectNames[item.projectId] = item.projectName
            names[item.workspaceId] = names[item.workspaceId] ?? item.workspaceName
        }
        for item in notifications {
            projectNames[item.projectId] = item.projectName
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
