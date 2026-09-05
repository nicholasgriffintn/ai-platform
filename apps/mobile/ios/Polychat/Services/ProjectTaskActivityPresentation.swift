import Foundation

struct ProjectTaskActivityPresentation: Equatable {
    enum Tone: Equatable {
        case active
        case attention
        case danger
        case neutral
        case success
    }

    let statusLabel: String
    let systemImage: String
    let tone: Tone

    static func resolve(_ item: ProjectTaskActivityItem) -> ProjectTaskActivityPresentation {
        let statusLabel: String
        let tone: Tone

        switch item.status {
        case "active":
            statusLabel = "In progress"
            tone = .active
        case "waiting":
            statusLabel = "Waiting"
            tone = .attention
        case "succeeded":
            statusLabel = "Completed"
            tone = .success
        case "failed":
            statusLabel = "Failed"
            tone = .danger
        case "interrupted":
            statusLabel = "Interrupted"
            tone = .danger
        case "cancelled":
            statusLabel = "Cancelled"
            tone = .neutral
        case "resolved":
            statusLabel = "Resolved"
            tone = .success
        case "proposed":
            statusLabel = "Proposed"
            tone = .neutral
        default:
            statusLabel = "Activity"
            tone = .neutral
        }

        let systemImage: String
        if tone == .danger {
            systemImage = "exclamationmark.octagon"
        } else if tone == .success {
            systemImage = "checkmark.circle"
        } else {
            switch item.category {
            case "plan":
                systemImage = "list.bullet.clipboard"
            case "tool":
                systemImage = "wrench.and.screwdriver"
            case "interaction":
                systemImage = "questionmark.bubble"
            case "output":
                systemImage = "doc.text"
            case "step":
                systemImage = "circle.dotted"
            default:
                systemImage = "ellipsis.circle"
            }
        }

        return ProjectTaskActivityPresentation(
            statusLabel: statusLabel,
            systemImage: systemImage,
            tone: tone
        )
    }
}
