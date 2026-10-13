import Foundation

enum ResponseTone: Equatable {
    case active
    case attention
    case danger
    case neutral
    case success
}

struct ResponsePresentation: Equatable {
    let label: String
    let detail: String
    let tone: ResponseTone

    static func resolve(_ response: PlatformResponse) -> ResponsePresentation {
        if response.status == "in_progress", let retry = response.retry {
            return ResponsePresentation(
                label: retry.phase == "waiting" ? "Retry scheduled" : "Retrying model",
                detail: "Attempt \(retry.attempt) of \(retry.maxAttempts) · run retry \(retry.runRetry) of \(retry.maxRunRetries) · \(retry.reason)",
                tone: .attention
            )
        }

        switch response.status {
        case "queued":
            return ResponsePresentation(label: "Task accepted", detail: "Waiting for execution to start.", tone: .active)
        case "in_progress":
            return ResponsePresentation(label: "Task running", detail: "Work is continuing.", tone: .active)
        case "awaiting_input":
            return ResponsePresentation(label: "Answer needed", detail: "The task is waiting for your answer.", tone: .attention)
        case "awaiting_approval":
            return ResponsePresentation(label: "Approval needed", detail: "The task is waiting for approval.", tone: .attention)
        case "awaiting_takeover":
            return ResponsePresentation(label: "Takeover needed", detail: "The task is waiting for you to control its computer.", tone: .attention)
        case "cancelling":
            return ResponsePresentation(label: "Stop requested", detail: "The task owner has not stopped yet.", tone: .attention)
        case "completed":
            return ResponsePresentation(label: "Task completed", detail: "The final result is available.", tone: .success)
        case "failed":
            return ResponsePresentation(label: "Task failed", detail: response.terminalReason ?? "The task could not finish.", tone: .danger)
        case "cancelled":
            return ResponsePresentation(label: "Task cancelled", detail: "Execution stopped after the request was accepted.", tone: .neutral)
        default:
            return ResponsePresentation(label: "Task interrupted", detail: response.terminalReason ?? "Execution ownership was lost.", tone: .danger)
        }
    }
}

struct ResponseUsagePresentation {
    static func credits(_ creditMicros: Int) -> String {
        let credits = Double(creditMicros) / 10_000
        return credits.formatted(.number.precision(.fractionLength(0...2)))
    }

    static func summary(_ usage: ResponseUsage) -> String {
        let consumption = usage.consumption.creditMicros.map {
            "\(credits($0)) credits consumed"
        } ?? "consumption unknown"
        return "\(usage.measurement) usage · \(consumption) · \(usage.settlement.status)"
    }
}
