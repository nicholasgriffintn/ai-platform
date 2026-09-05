import Foundation

struct WorkAttentionResponse: Decodable {
    let items: [WorkAttentionItem]
    let total: Int
    let hasMore: Bool
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

struct MobileProjectTaskDetail: Decodable {
    let task: MobileProjectTask
    let pendingQuestions: MobileUserQuestionSet?
    let pendingApproval: MobileProjectTaskApproval?
}

struct MobileProjectTask: Decodable {
    let id: String
    let projectId: String
    let workspaceId: String
    let objective: String
    let status: String
    let blockedReason: String?
    let blockedDetail: String?
    let conversationId: String?
}

struct MobileUserQuestionSet: Decodable {
    let interactionId: String
    let questions: [MobileUserQuestion]
}

struct MobileUserQuestion: Decodable, Identifiable {
    let id: String
    let prompt: String
    let options: [MobileUserQuestionOption]
    let allowOther: Bool
}

struct MobileUserQuestionOption: Decodable, Identifiable {
    let label: String
    let description: String?

    var id: String { label }
}

struct MobileProjectTaskApproval: Decodable {
    let interactionId: String
    let toolName: String
    let reason: String
}

struct MobileProjectTaskResponse: Decodable {
    let task: MobileProjectTask
}

struct MobileUserQuestionAnswer: Encodable {
    let questionId: String
    let answer: String
}

struct AnswerMobileProjectTaskQuestionsRequest: Encodable {
    let interactionId: String
    let answers: [MobileUserQuestionAnswer]
}

struct ResolveMobileProjectTaskApprovalRequest: Encodable {
    let interactionId: String
    let resolution: String
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
}

struct RegisterMobilePushDeviceRequest: Encodable {
    let token: String
    let environment: String
    let appBundleId: String
}

struct UnregisterMobilePushDeviceRequest: Encodable {
    let token: String
}

struct SubmitSandboxRunInstructionRequest: Encodable {
    let kind: String
    let idempotencyKey: String
    let content: String?
    let requestId: String?
    let approvalStatus: String?
}

struct UpdateSandboxRunControlRequest: Encodable {
    let action: String
    let expectedUpdatedAt: String
}
