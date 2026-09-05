import Foundation

struct TurnActivityProjection: Equatable {
    enum Phase: Equatable {
        case preparing
        case reasoning
        case generating
        case preparingTool
        case usingTools
        case finalising
        case waiting
        case reconnecting
        case completed
        case failed
        case cancelled
    }

    struct Tool: Equatable {
        enum Status: Equatable {
            case preparing
            case running
            case success
            case failure
        }

        let id: String
        var name: String
        var status: Status
    }

    private(set) var phase: Phase = .preparing
    private(set) var label = "Preparing response..."
    private(set) var step: Int?
    private(set) var tools: [Tool] = []
    private(set) var requiresAction = false

    mutating func apply(_ event: ChatTurnActivityEvent) {
        switch event {
        case .turnStarted:
            self = TurnActivityProjection()
        case .modelStepStarted(let step):
            setPhase(.preparing, label: "Preparing next step...", step: step)
        case .reasoningStarted(let step):
            setPhase(.reasoning, label: "Reasoning...", step: step)
        case .reasoningFinished(let step):
            setPhase(.preparing, label: "Preparing next step...", step: step)
        case .responseStarted(let step):
            setPhase(.generating, label: "Generating response...", step: step)
        case .responseFinished(let step):
            setPhase(.finalising, label: "Finalising response...", step: step)
        case .toolInputStarted(let step, let toolCallId, let toolName):
            updateTool(id: toolCallId, name: toolName, status: .preparing)
            setPhase(.preparingTool, label: "Preparing \(toolName)...", step: step)
        case .toolInputFinished(let step, _, _):
            self.step = step
        case .toolExecutionStarted(let step, let toolCallId, let toolName):
            updateTool(id: toolCallId, name: toolName, status: .running)
            setPhase(.usingTools, label: toolExecutionLabel, step: step)
        case .toolFinished(let step, let toolCallId, let toolName, let outcome):
            updateTool(
                id: toolCallId,
                name: toolName,
                status: outcome == .success ? .success : .failure
            )
            let hasRunningTool = tools.contains { $0.status == .running }
            setPhase(
                hasRunningTool ? .usingTools : .preparing,
                label: outcome == .failure ? "\(toolName) failed. Continuing..." : toolExecutionLabel,
                step: step
            )
        case .waitingForUser(let step, let toolCallId, let toolName, let reason):
            updateTool(id: toolCallId, name: toolName, status: .preparing)
            requiresAction = true
            setPhase(
                .waiting,
                label: reason == .question ? "Waiting for your answer." : "Waiting for your approval.",
                step: step
            )
        case .modelStepFinished(let step, let outcome):
            self.step = step
            if outcome == .failed {
                setPhase(.failed, label: "Response failed.", step: step)
            }
        case .turnFinished(let outcome, _):
            switch outcome {
            case .completed:
                setPhase(.completed, label: "Response complete.")
            case .failed:
                setPhase(.failed, label: "Response failed.")
            case .cancelled:
                setPhase(.cancelled, label: "Response stopped.")
            case .waiting:
                requiresAction = true
                setPhase(.waiting, label: label)
            }
        }
    }

    mutating func markReconnecting() {
        phase = .reconnecting
        label = "Reconnecting to the response..."
    }

    private mutating func setPhase(_ phase: Phase, label: String, step: Int? = nil) {
        self.phase = phase
        self.label = label
        if let step {
            self.step = step
        }
    }

    private mutating func updateTool(id: String, name: String, status: Tool.Status) {
        if let index = tools.firstIndex(where: { $0.id == id }) {
            tools[index].name = name
            tools[index].status = status
        } else {
            tools.append(Tool(id: id, name: name, status: status))
        }
    }

    private var toolExecutionLabel: String {
        let running = tools.filter { $0.status == .running }

        if running.count == 1, let tool = running.first {
            return "Running \(tool.name)..."
        }

        return running.count > 1 ? "Running \(running.count) tools..." : "Preparing next step..."
    }
}
