import Foundation

enum ModelContinuityState: Equatable {
    case nextRun
    case newConversationRequired
    case blocked
}

struct ModelContinuityDecision: Equatable {
    let state: ModelContinuityState
    let reason: String
    let unsupportedAttachments: [ComposerAttachmentType]

    var allowsSelection: Bool {
        state == .nextRun
    }
}

enum ModelContinuity {
    static func evaluate(
        model: ModelConfigItem,
        hasConversationHistory: Bool,
        activeRun: ChatRun?,
        attachmentTypes: [ComposerAttachmentType]
    ) -> ModelContinuityDecision {
        if let activeRun, activeRun.isActive {
            let reason = activeRun.isWaiting
                ? "Resolve or cancel the current approval or question before changing models. It belongs to the model run that requested it."
                : "Wait for or cancel the current model run before changing models."
            return ModelContinuityDecision(
                state: .blocked,
                reason: reason,
                unsupportedAttachments: []
            )
        }

        let unsupported = Array(Set(attachmentTypes)).filter { !supports($0, model: model) }
            .sorted { $0.rawValue < $1.rawValue }

        if !unsupported.isEmpty {
            return ModelContinuityDecision(
                state: .blocked,
                reason: "\(model.name ?? model.id) cannot use the attached \(unsupported.map(\.displayName).joined(separator: ", ")) content. Remove it or choose a compatible model.",
                unsupportedAttachments: unsupported
            )
        }

        if hasConversationHistory && model.isImageGenerationOnly && model.supportsImageEdits != true {
            return ModelContinuityDecision(
                state: .newConversationRequired,
                reason: "\(model.name ?? model.id) only supports the first turn of a conversation. Start a new conversation to use it; this conversation's history will not carry across.",
                unsupportedAttachments: []
            )
        }

        return ModelContinuityDecision(
            state: .nextRun,
            reason: hasConversationHistory
                ? "The next message starts a new run with \(model.name ?? model.id). Existing conversation history and compatible attachments remain; model-specific response settings reset."
                : "The next message starts a run with \(model.name ?? model.id); model-specific response settings reset.",
            unsupportedAttachments: []
        )
    }

    private static func supports(_ attachment: ComposerAttachmentType, model: ModelConfigItem) -> Bool {
        let inputs = model.modalities?.input ?? ["text"]

        switch attachment {
        case .image:
            return model.multimodal == true || inputs.contains("image")
        case .audio:
            return model.supportsAudio == true || inputs.contains("audio")
        case .document:
            return model.supportsDocuments == true || model.supportsAttachments == true || inputs.contains("pdf")
        case .markdownDocument:
            return inputs.contains("text")
        }
    }
}

private extension ComposerAttachmentType {
    var displayName: String {
        switch self {
        case .image:
            return "image"
        case .document:
            return "document"
        case .audio:
            return "audio"
        case .markdownDocument:
            return "document"
        }
    }
}

private extension ModelConfigItem {
    var isImageGenerationOnly: Bool {
        guard let outputs = modalities?.output else { return false }
        return outputs.contains("image") && !outputs.contains("text")
    }
}
