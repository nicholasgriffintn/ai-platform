import Foundation

struct WorkAttentionResponse: Decodable {
    let items: [WorkAttentionItem]
    let total: Int
    let hasMore: Bool

    enum CodingKeys: String, CodingKey {
        case items = "data"
        case total
        case hasMore = "has_more"
    }
}

struct WorkAttentionItem: Decodable, Identifiable {
    let id: String
    let kind: String
    let type: String
    let resourceId: String
    let workspaceId: String
    let workspaceName: String
    let projectId: String
    let projectName: String
    let conversationId: String?
    let isUnread: Bool
    let title: String
    let detail: String?
    let occurredAt: String
}

struct MobileWorkTarget: Codable, Hashable, Identifiable {
    let workspaceId: String
    let projectId: String
    let conversationId: String?
    let taskId: String?
    let runId: String?
    let interactionId: String?

    var id: String {
        runId ?? taskId ?? conversationId ?? "\(workspaceId):\(projectId)"
    }
}

struct SandboxRunDetail: Decodable {
    let run: SandboxRun
    let createdByUserId: Int
    let projectId: String?
    let conversationId: String?
}

struct SandboxRun: Decodable {
    let runId: String
    let repo: String
    let task: String
    let model: String
    let status: String
    let startedAt: String
    let updatedAt: String
    let completedAt: String?
    let manifest: SandboxRunManifest?

    var isTerminal: Bool {
        status == "completed" || status == "failed" || status == "cancelled"
    }
}

struct SandboxRunManifest: Decodable {
    let outcome: SandboxRunOutcome
    let changes: SandboxRunChanges
    let validation: SandboxRunValidation
    let residualRisks: [String]
    let incompleteWork: [String]
}

struct SandboxRunOutcome: Decodable {
    let status: String
    let success: Bool
    let summary: String?
    let error: String?
    let cancellationReason: String?
}

struct SandboxRunChanges: Decodable {
    let fileCount: Int
    let files: [String]
    let filesTruncated: Bool
    let summary: String?
}

struct SandboxRunValidation: Decodable {
    let qualityGate: String
    let checks: [SandboxRunValidationCheck]
}

struct SandboxRunValidationCheck: Decodable, Identifiable {
    let command: String
    let status: String
    let exitCode: Int?

    var id: String { "\(command):\(status)" }
}

struct SandboxRunEventsResponse: Decodable {
    let events: [SandboxRunEventEnvelope]

    enum CodingKeys: String, CodingKey {
        case events = "data"
    }
}

struct SandboxRunEventEnvelope: Decodable, Identifiable {
    let index: Int
    let recordedAt: String
    let event: SandboxRunEvent

    var id: Int { index }
}

struct SandboxRunEvent: Decodable {
    let type: String
    let message: String?
    let path: String?
    let changeType: String?
    let timestamp: String?
    let serviceName: String?
    let serviceStatus: String?
    let approvalStatus: String?
}

struct SandboxRunInstructionsResponse: Decodable {
    let instructions: [SandboxRunInstructionEnvelope]

    enum CodingKeys: String, CodingKey {
        case instructions = "data"
    }
}

struct SandboxRunInstructionEnvelope: Decodable, Identifiable {
    let index: Int
    let recordedAt: String
    let instruction: SandboxRunInstruction

    var id: Int { index }
}

struct SandboxRunInstruction: Decodable {
    let id: String
    let kind: String
    let requestId: String?
    let approvalStatus: String?
    let expiresAt: String?
    let resolvedAt: String?

    var canRespond: Bool {
        kind == "approval_request" &&
        resolvedAt == nil &&
        approvalStatus != "timed_out" &&
        approvalStatus != "rejected" &&
        approvalStatus != "approved"
    }
}

struct SandboxRunControl: Decodable {
    let runId: String
    let state: String
    let updatedAt: String
}

struct SandboxRunInstructionResponse: Decodable {
    let instruction: SandboxRunInstruction

    init(from decoder: Decoder) throws {
        instruction = try SandboxRunInstruction(from: decoder)
    }
}

struct RegisterMobilePushDeviceRequest: Encodable {
    let token: String
    let environment: String
    let appBundleId: String
}

struct MobilePushRegistration: Decodable, Equatable {
    let registered: Bool
    let deliverable: Bool
}

struct SubmitSandboxRunInstructionRequest: Encodable {
    let kind: String
    let idempotencyKey: String
    let content: String?
    let requestId: String?
    let approvalStatus: String?
}

struct EnvironmentActionRequest: Encodable {
    let action: String
    let expectedUpdatedAt: String

    enum CodingKeys: String, CodingKey {
        case action
        case expectedUpdatedAt = "expected_updated_at"
    }
}

struct EnvironmentResponse<Detail: Decodable>: Decodable {
    let id: String
    let kind: String
    let detail: Detail
}

struct EnvironmentListResponse<Detail: Decodable>: Decodable {
    let data: [EnvironmentResponse<Detail>]
}

extension WorkAttentionItem {
    var needsAction: Bool {
        kind == "approval" || kind == "input" || kind == "review"
    }

    var isRunning: Bool {
        kind == "running"
    }

    var target: MobileWorkTarget {
        MobileWorkTarget(
            workspaceId: workspaceId,
            projectId: projectId,
            conversationId: conversationId,
            taskId: type == "run" ? nil : resourceId,
            runId: type == "run" ? resourceId : nil,
            interactionId: nil
        )
    }
}

struct BackgroundTaskListResponse: Decodable {
    let tasks: [BackgroundTask]

    enum CodingKeys: String, CodingKey {
        case tasks = "data"
    }
}

struct BackgroundTask: Decodable, Identifiable, Equatable {
    let id: String
    let taskType: String
    let status: String?
    let errorMessage: String?
    let createdAt: String
    let updatedAt: String?
    let metadata: [String: JSONValue]?

    enum CodingKeys: String, CodingKey {
        case id, status, metadata
        case taskType = "task_type"
        case errorMessage = "error_message"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    var isActive: Bool {
        ["pending", "queued", "running"].contains(status ?? "")
    }

    var title: String {
        metadata?["title"]?.stringValue ?? taskType.replacingOccurrences(of: "_", with: " ").capitalized
    }
}

struct WorkspaceListResponse: Decodable {
    let data: [WorkspaceSummary]
}

struct WorkspaceSummary: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let role: String
}

struct WorkspaceDetail: Decodable, Equatable {
    let id: String
    let name: String
    let projects: [ProjectSummary]
}

struct ProjectSummary: Decodable, Identifiable, Equatable {
    let id: String
    let workspaceId: String
    let name: String
    let description: String
    let colour: String
    let conversationCount: Int?
}

struct ProjectDetail: Decodable, Equatable {
    let id: String
    let name: String
    let conversations: [ProjectConversation]
}

struct ProjectConversation: Decodable, Identifiable, Equatable {
    struct Creator: Decodable, Equatable {
        let name: String?
    }

    let id: String
    let title: String?
    let createdAt: String
    let updatedAt: String?
    let lastMessageAt: String?
    let messageCount: Int
    let isPinned: Bool
    let isUnread: Bool
    let createdBy: Creator

    var activityDate: Date {
        AppDateParser.parse(lastMessageAt ?? updatedAt ?? createdAt, fallback: Date.distantPast)
    }

    func conversation(projectId: String) -> Conversation {
        var conversation = Conversation(
            id: id,
            title: title ?? "Untitled conversation",
            messages: [],
            createdAt: AppDateParser.parse(createdAt, fallback: Date()),
            isLoadedFromAPI: true,
            lastMessageAt: AppDateParser.parse(lastMessageAt ?? updatedAt),
            messageCount: messageCount
        )
        conversation.projectId = projectId
        conversation.isPinned = isPinned
        conversation.isUnread = isUnread
        return conversation
    }
}

struct WorkInboxItem: Decodable, Identifiable, Hashable {
    let id: String
    let kind: String
    let workspaceId: String?
    let projectId: String?
    let taskId: String?
    let teammateId: String?
    let title: String
    let detail: String?
    let dueAt: String?
    let conversationId: String?
    let since: String
    let deepLink: String

    var target: MobileWorkTarget? {
        guard let workspaceId, let projectId, let taskId else { return nil }
        return MobileWorkTarget(
            workspaceId: workspaceId,
            projectId: projectId,
            conversationId: nil,
            taskId: taskId,
            runId: nil,
            interactionId: nil
        )
    }
}

struct ProjectTaskListResponse: Decodable {
    let tasks: [ProjectTask]

    enum CodingKeys: String, CodingKey {
        case tasks = "data"
    }
}

struct WorkTaskListResponse: Decodable {
    let tasks: [ProjectTask]
}

enum WorkActor: Decodable, Equatable, Hashable {
    case teammate(String)
    case person(Int)

    private enum CodingKeys: String, CodingKey {
        case type, id, userId
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decode(String.self, forKey: .type) {
        case "teammate":
            self = .teammate(try container.decode(String.self, forKey: .id))
        default:
            self = .person(try container.decode(Int.self, forKey: .userId))
        }
    }
}

struct ProjectTask: Decodable, Identifiable, Equatable, Hashable {
    let id: String
    let projectId: String
    let workspaceId: String
    let key: String?
    let kind: String
    let objective: String
    let description: String?
    let priority: String
    let owner: WorkActor?
    let status: String
    let blockedReason: String?
    let blockedDetail: String?
    let conversationId: String?
    let runId: String?
    let dueAt: String?
    let createdAt: String
    let updatedAt: String?
    let completedAt: String?

    var activityDate: Date {
        AppDateParser.parse(completedAt ?? updatedAt ?? createdAt, fallback: Date.distantPast)
    }
}

struct CreateProjectTaskRequest: Encodable {
    let objective: String
}

struct WorkPlace: Decodable, Equatable {
    struct Project: Decodable, Equatable {
        let id: String
        let name: String
    }

    let id: String
    let name: String
    let projects: [Project]
}

struct WorkInboxResponse: Decodable {
    let items: [WorkInboxItem]
    let places: [WorkPlace]

    enum CodingKeys: String, CodingKey {
        case items = "data"
        case places
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        items = try container.decode([WorkInboxItem].self, forKey: .items)
        places = try container.decodeIfPresent([WorkPlace].self, forKey: .places) ?? []
    }
}

struct WorkAcknowledgement: Decodable {}

struct WorkSetupState: Decodable {
    struct Setup: Decodable {
        let revision: Int
        let appliedAt: String?
    }

    let setup: Setup?
}

struct StandupAnswer: Codable, Hashable {
    let question: String
    var answer: String
}

struct StandupAnswers: Codable {
    var answers: [StandupAnswer]
}

struct HireDecisionRequest: Encodable {
    let decision: String
}

struct SetupApprovalRequest: Encodable {
    let revision: Int
}
