import Foundation
public struct ChatSettings: Codable, Equatable {
    public var temperature: Double
    public var topP: Double
    public var maxTokens: Int?
    public var presencePenalty: Double
    public var frequencyPenalty: Double
    public var reasoningEffort: ReasoningEffort?
    public var verbosity: VerbosityLevel?
    public var enabledTools: [String]
    public var toolOptions: [String: JSONValue]

    public enum ReasoningEffort: String, Codable, CaseIterable {
        case none = "none"
        case simulatedThinking = "simulated-thinking"
        case thinking = "thinking"
        case `default` = "default"
        case minimal = "minimal"
        case low = "low"
        case medium = "medium"
        case high = "high"
        case xhigh = "xhigh"
        case max = "max"

        public var displayName: String {
            switch self {
            case .none:
                return "None"
            case .simulatedThinking:
                return "Thinking"
            case .thinking:
                return "Thinking"
            case .default:
                return "Default"
            case .minimal:
                return "Minimal"
            case .low:
                return "Low"
            case .medium:
                return "Medium"
            case .high:
                return "High"
            case .xhigh:
                return "X-high"
            case .max:
                return "Max"
            }
        }
    }

    public enum VerbosityLevel: String, Codable, CaseIterable {
        case low = "low"
        case medium = "medium"
        case high = "high"
        case caveman = "caveman"

        public var displayName: String {
            rawValue.capitalized
        }
    }

    public static let `default` = ChatSettings(
        temperature: 0.7,
        topP: 0.8,
        maxTokens: nil,
        presencePenalty: 0,
        frequencyPenalty: 0,
        reasoningEffort: nil,
        verbosity: nil,
        enabledTools: [],
        toolOptions: [:]
    )

    public init(
        temperature: Double = 0.7,
        topP: Double = 0.8,
        maxTokens: Int? = nil,
        presencePenalty: Double = 0,
        frequencyPenalty: Double = 0,
        reasoningEffort: ReasoningEffort? = nil,
        verbosity: VerbosityLevel? = nil,
        enabledTools: [String] = [],
        toolOptions: [String: JSONValue] = [:]
    ) {
        self.temperature = temperature
        self.topP = topP
        self.maxTokens = maxTokens
        self.presencePenalty = presencePenalty
        self.frequencyPenalty = frequencyPenalty
        self.reasoningEffort = reasoningEffort
        self.verbosity = verbosity
        self.enabledTools = enabledTools
        self.toolOptions = toolOptions
    }
}
