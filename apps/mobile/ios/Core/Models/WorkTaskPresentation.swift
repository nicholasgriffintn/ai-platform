import SwiftUI

enum WorkTaskGroup: String, CaseIterable, Identifiable {
    case needsYou
    case working
    case upNext
    case finished

    var id: String { rawValue }

    var title: String {
        switch self {
        case .needsYou: return "Needs you"
        case .working: return "In progress"
        case .upNext: return "Up next"
        case .finished: return "Finished"
        }
    }

    static func of(_ task: ProjectTask) -> WorkTaskGroup {
        switch task.status {
        case "blocked", "review": return .needsYou
        case "running", "queued": return .working
        case "done", "cancelled": return .finished
        default: return .upNext
        }
    }
}

struct WorkTaskSection: Identifiable {
    let group: WorkTaskGroup
    let tasks: [ProjectTask]

    var id: String { group.id }
}

enum WorkTaskPresentation {
    static func sections(for tasks: [ProjectTask]) -> [WorkTaskSection] {
        let visible = tasks.filter { $0.kind != "standup" || $0.status != "done" }
        let grouped = Dictionary(grouping: visible, by: WorkTaskGroup.of)

        return WorkTaskGroup.allCases.compactMap { group in
            guard let members = grouped[group], !members.isEmpty else { return nil }
            return WorkTaskSection(group: group, tasks: members.sorted { $0.activityDate > $1.activityDate })
        }
    }

    static func statusLabel(_ task: ProjectTask) -> String {
        statusLabel(status: task.status, blockedReason: task.blockedReason)
    }

    static func statusLabel(status: String, blockedReason: String?) -> String {
        switch status {
        case "blocked":
            switch blockedReason {
            case "awaiting_input", "awaiting_takeover": return "Needs an answer"
            case "awaiting_approval": return "Needs approval"
            case "machine_offline": return "Machine offline"
            case "dependencies_unmet": return "Waiting on others"
            default: return "Stuck"
            }
        case "review": return "Ready to review"
        case "running": return "Running"
        case "queued": return "Queued"
        case "backlog": return "Backlog"
        case "done": return "Done"
        case "cancelled": return "Cancelled"
        default: return status.capitalized
        }
    }

    static func tint(_ task: ProjectTask) -> Color {
        switch task.status {
        case "blocked":
            return ["awaiting_input", "awaiting_approval", "awaiting_takeover"].contains(task.blockedReason ?? "")
                ? Color.polychat.attention
                : Color.polychat.error
        case "review": return Color.polychat.attention
        case "running", "queued": return Color.polychat.activeWork
        case "done": return Color.polychat.success
        default: return Color.polychat.textMuted
        }
    }

    static func icon(_ task: ProjectTask) -> String {
        switch task.status {
        case "blocked":
            switch task.blockedReason {
            case "awaiting_input", "awaiting_takeover": return "questionmark.bubble"
            case "awaiting_approval": return "checkmark.shield"
            default: return "exclamationmark.triangle"
            }
        case "review": return "doc.text.magnifyingglass"
        case "running": return "bolt.horizontal"
        case "queued": return "clock"
        case "done": return "checkmark.circle"
        case "cancelled": return "xmark.circle"
        default: return "circle"
        }
    }

    static func canStart(_ task: ProjectTask) -> Bool {
        task.status == "backlog" && task.kind == "task"
    }
}
