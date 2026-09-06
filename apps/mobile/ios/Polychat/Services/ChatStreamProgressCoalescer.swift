import Foundation

struct ChatStreamProgressUpdate: Equatable {
    let conversationId: String
    let messageId: String
    let content: String
    let modelId: String?
    let fallbackMessageId: String
}

@MainActor
final class ChatStreamProgressCoalescer {
    private let interval: Duration
    private let onUpdate: (ChatStreamProgressUpdate) -> Void
    private var pending: ChatStreamProgressUpdate?
    private var scheduled: Task<Void, Never>?
    private var stopped = false

    init(
        interval: Duration = .milliseconds(16),
        onUpdate: @escaping (ChatStreamProgressUpdate) -> Void
    ) {
        self.interval = interval
        self.onUpdate = onUpdate
    }

    func update(_ update: ChatStreamProgressUpdate) {
        guard !stopped else {
            onUpdate(update)
            return
        }

        pending = update

        guard scheduled == nil else {
            return
        }

        scheduled = Task { @MainActor [weak self] in
            guard let self else {
                return
            }

            try? await Task.sleep(for: interval)

            if !Task.isCancelled {
                deliver()
            }
        }
    }

    func flush() {
        scheduled?.cancel()
        scheduled = nil
        deliver()
    }

    func stop() {
        stopped = true
        flush()
    }

    private func deliver() {
        scheduled = nil

        guard let update = pending else {
            return
        }

        pending = nil
        onUpdate(update)
    }
}

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
