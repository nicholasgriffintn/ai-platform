import Foundation

enum ChatRunTone: Equatable {
    case active
    case attention
    case danger
    case neutral
    case success
}

struct ChatRunPresentation: Equatable {
    let label: String
    let detail: String
    let tone: ChatRunTone

    static func resolve(_ run: ChatRun) -> ChatRunPresentation {
        if run.status == "running", let retry = run.retry {
            return ChatRunPresentation(
                label: retry.phase == "waiting" ? "Retry scheduled" : "Retrying model",
                detail: "Attempt \(retry.attempt) of \(retry.maxAttempts) · run retry \(retry.runRetry) of \(retry.maxRunRetries) · \(retry.reason)",
                tone: .attention
            )
        }

        switch run.status {
        case "accepted":
            return ChatRunPresentation(label: "Task accepted", detail: "Waiting for execution to start.", tone: .active)
        case "running":
            return ChatRunPresentation(label: "Task running", detail: "Work is continuing.", tone: .active)
        case "awaiting_input":
            return ChatRunPresentation(label: "Answer needed", detail: "The task is waiting for your answer.", tone: .attention)
        case "awaiting_approval":
            return ChatRunPresentation(label: "Approval needed", detail: "The task is waiting for approval.", tone: .attention)
        case "cancelling":
            return ChatRunPresentation(label: "Stop requested", detail: "The task owner has not stopped yet.", tone: .attention)
        case "succeeded":
            return ChatRunPresentation(label: "Task completed", detail: "The final result is available.", tone: .success)
        case "failed":
            return ChatRunPresentation(label: "Task failed", detail: run.terminalReason ?? "The task could not finish.", tone: .danger)
        case "cancelled":
            return ChatRunPresentation(label: "Task cancelled", detail: "Execution stopped after the request was accepted.", tone: .neutral)
        default:
            return ChatRunPresentation(label: "Task interrupted", detail: run.terminalReason ?? "Execution ownership was lost.", tone: .danger)
        }
    }
}

struct ChatRunUsagePresentation {
    static func credits(_ creditMicros: Int) -> String {
        let credits = Double(creditMicros) / 10_000
        return credits.formatted(.number.precision(.fractionLength(0...2)))
    }

    static func summary(_ usage: ChatRunUsage) -> String {
        let consumption = usage.consumption.creditMicros.map {
            "\(credits($0)) credits consumed"
        } ?? "consumption unknown"
        return "\(usage.measurement) usage · \(consumption) · \(usage.settlement.status)"
    }
}
