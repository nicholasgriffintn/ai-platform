import Foundation

extension PlatformResponse {
    static let terminalStatuses: Set<String> = ["completed", "failed", "cancelled", "incomplete"]

    var isTerminal: Bool {
        Self.terminalStatuses.contains(status)
    }

    var isWaiting: Bool {
        status == "awaiting_input" || status == "awaiting_approval" || status == "awaiting_takeover"
    }

    var isActive: Bool {
        !isTerminal
    }
}
