import Foundation
public struct ChatSettings: Codable, Equatable {
    public var temperature: Double?
    public var topP: Double?
    public var maxTokens: Int?
    public var presencePenalty: Double?
    public var frequencyPenalty: Double?
    public var useRag: Bool
    public var ragOptions: RagOptions
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
                return "Instant"
            case .simulatedThinking:
                return "Simulated"
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

        public static let defaultSupportedLevels: [ReasoningEffort] = [.none, .simulatedThinking]

        public static func supportedLevels(for model: ModelConfigItem?) -> [ReasoningEffort] {
            let configured = (model?.reasoningConfig?.supportedEffortLevels ?? [])
                .compactMap(ReasoningEffort.init(rawValue:))

            return configured.isEmpty ? defaultSupportedLevels : configured
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
        temperature: nil,
        topP: nil,
        maxTokens: nil,
        presencePenalty: nil,
        frequencyPenalty: nil,
        useRag: false,
        ragOptions: .default,
        reasoningEffort: nil,
        verbosity: nil,
        enabledTools: [],
        toolOptions: [:]
    )

    public init(
        temperature: Double? = nil,
        topP: Double? = nil,
        maxTokens: Int? = nil,
        presencePenalty: Double? = nil,
        frequencyPenalty: Double? = nil,
        useRag: Bool = false,
        ragOptions: RagOptions = .default,
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
        self.useRag = useRag
        self.ragOptions = ragOptions
        self.reasoningEffort = reasoningEffort
        self.verbosity = verbosity
        self.enabledTools = enabledTools
        self.toolOptions = toolOptions
    }
}
