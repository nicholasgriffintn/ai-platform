import Foundation

enum ChatContextPresentation {
    static func usageLabel(_ usage: ChatContextUsage) -> String {
        let input = usage.inputTokens.formatted()
        let limit = usage.contextWindow.formatted()
        let source = usage.source == "reported" ? "reported" : "estimated"

        return "\(input) \(source) tokens of \(limit)"
    }

    static func omissionLabel(_ omission: ChatContextOmission) -> String {
        switch omission.kind {
        case "tool_result":
            return "Tool result shortened"
        case "source":
            return "Attached source omitted"
        default:
            return "\(omission.count) older \(omission.count == 1 ? "message" : "messages") omitted"
        }
    }
}
