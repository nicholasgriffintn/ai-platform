import Foundation

struct ResponseTurnAssembler {
    private struct Segment {
        var id: String
        var model: String?
        var content = ""
        var reasoning = ""
        var metadata: ChatStreamMetadata?
        var isFinalised = false

        var isEmpty: Bool {
            content.isEmpty && reasoning.isEmpty && metadata?.parts?.isEmpty != false
        }
    }

    private let completionId: String
    private let makeId: () -> String
    private var entries: [Entry] = []
    private var segments: [Segment] = []
    private var toolActivity = StreamingToolActivity()
    private(set) var compaction: ChatMessage?

    private enum Entry {
        case segment(Int)
        case tool(ChatMessage)
    }

    init(
        completionId: String,
        initialMessageId: String,
        model: String?,
        makeId: @escaping () -> String = { UUID().uuidString }
    ) {
        self.completionId = completionId
        self.makeId = makeId
        openSegment(id: initialMessageId, model: model)
    }

    var currentMessageId: String? {
        segments.last?.id
    }

    var messages: [ChatMessage] {
        entries.compactMap { entry in
            switch entry {
            case .segment(let index):
                let segment = segments[index]
                return segment.isFinalised && segment.isEmpty ? nil : message(for: segment)
            case .tool(let message):
                return message
            }
        }
    }

    var finishedMessages: [ChatMessage] {
        let interimIds = Set(toolActivity.interimMessageIds)
        return messages.filter { !interimIds.contains($0.id) && !($0.role == "assistant" && isBlank($0)) }
    }

    @discardableResult
    mutating func apply(_ event: ChatStreamEvent) -> Bool {
        switch event {
        case .assistantStarted(let start):
            if var segment = segments.last, !segment.isFinalised, segment.isEmpty {
                segment.id = start.messageId ?? segment.id
                segment.model = start.model ?? segment.model
                segments[segments.count - 1] = segment
            } else if segments.last?.isFinalised != false {
                openSegment(id: start.messageId ?? makeId(), model: start.model)
            }
            return true
        case .content(let delta):
            updateOpenSegment { $0.content += delta }
            return true
        case .reasoning(let delta):
            updateOpenSegment { $0.reasoning += delta }
            return true
        case .metadata(let metadata):
            let index = segments.lastIndex { $0.id == metadata.messageId }
                ?? segments.indices.last.flatMap { segments[$0].metadata == nil ? $0 : nil }
            guard let index else {
                openSegment(id: metadata.messageId ?? makeId(), model: metadata.model)
                return apply(event)
            }
            segments[index].id = metadata.messageId ?? segments[index].id
            segments[index].model = metadata.model ?? segments[index].model
            if let content = metadata.content, !content.isEmpty {
                segments[index].content = content
            }
            segments[index].metadata = metadata
            segments[index].isFinalised = true
            return true
        case .messageStop, .toolOutputsDone:
            updateLastSegment { $0.isFinalised = true }
            return true
        case .toolUseStart(let call):
            toolActivity.start(call)
            updateLastSegment { $0.isFinalised = true }
            return false
        case .toolUseDelta(let call):
            toolActivity.applyDelta(call)
            return false
        case .toolUseStop(let toolCallId):
            guard let update = toolActivity.stop(toolCallId: toolCallId, completionId: completionId) else {
                return false
            }
            apply(update)
            return true
        case .toolResult(let result):
            guard let update = toolActivity.resolve(result, completionId: completionId) else {
                return false
            }
            apply(update)
            return true
        case .compaction(let message):
            compaction = message
            return true
        case .state, .response, .conversationTitle, .turnActivity, .usageLimits, .done:
            return false
        }
    }

    private mutating func apply(_ update: StreamingToolActivity.Update) {
        let replacedId = update.replacingMessageId ?? update.message.id
        if let index = entries.firstIndex(where: { entry in
            if case .tool(let message) = entry { return message.id == replacedId }
            return false
        }) {
            entries[index] = .tool(update.message)
        } else {
            entries.append(.tool(update.message))
        }
    }

    private mutating func openSegment(id: String, model: String?) {
        segments.append(Segment(id: id, model: model))
        entries.append(.segment(segments.count - 1))
    }

    private mutating func updateOpenSegment(_ change: (inout Segment) -> Void) {
        if segments.last?.isFinalised != false {
            openSegment(id: makeId(), model: segments.last?.model)
        }
        updateLastSegment(change)
    }

    private mutating func updateLastSegment(_ change: (inout Segment) -> Void) {
        guard !segments.isEmpty else {
            return
        }
        change(&segments[segments.count - 1])
    }

    private func message(for segment: Segment) -> ChatMessage {
        let metadata = segment.metadata
        let reasoning = metadata?.reasoning
            ?? (segment.reasoning.isEmpty ? nil : ChatReasoning(collapsed: !segment.content.isEmpty, content: segment.reasoning))

        return ChatMessage(
            id: segment.id,
            role: "assistant",
            content: segment.content,
            model: segment.model,
            parts: metadata?.parts,
            reasoning: reasoning,
            citations: metadata?.citations,
            data: metadata?.data,
            completionId: completionId,
            name: metadata?.name,
            status: metadata?.status ?? (segment.isFinalised ? "completed" : "in_progress"),
            logId: metadata?.logId,
            created: metadata?.created,
            timestamp: metadata?.created
        )
    }

    private func isBlank(_ message: ChatMessage) -> Bool {
        message.textContent.isEmpty && message.reasoning == nil && message.parts?.isEmpty != false
    }
}
