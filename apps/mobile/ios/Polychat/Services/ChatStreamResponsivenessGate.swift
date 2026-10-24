import Foundation

struct ChatStreamResponsivenessGate {
    static let progressEventLimit = 64

    private var progressEventCount = 0

    mutating func shouldYield(after event: ChatStreamEvent) -> Bool {
        guard event.isProgressDelta else {
            progressEventCount = 0
            return false
        }

        progressEventCount += 1

        guard progressEventCount >= Self.progressEventLimit else {
            return false
        }

        progressEventCount = 0
        return true
    }
}

extension ChatStreamEvent {
    var isProgressDelta: Bool {
        switch self {
        case .content, .reasoning:
            return true
        default:
            return false
        }
    }
}
