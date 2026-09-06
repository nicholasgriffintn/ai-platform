import Foundation

struct ProjectTaskInteraction: Codable, Equatable {
    let protocolVersion: Int
    let type: String
    let projectId: String
    let taskId: String
    let runId: String?
    let interactionId: String
    let status: String
    let requestedAt: String
    let resolvedAt: String?
    let detail: String?
    let questions: [UserQuestion]?
    let answers: [UserQuestionAnswer]?
    let toolName: String?
    let reason: String?
    let resolution: String?

    var isPending: Bool {
        status == "pending"
    }

    var isSupported: Bool {
        guard protocolVersion == 1 else {
            return false
        }

        switch type {
        case "question":
            return questions?.isEmpty == false
        case "approval":
            return toolName?.isEmpty == false && reason?.isEmpty == false
        default:
            return false
        }
    }
}

struct UserQuestion: Codable, Equatable, Identifiable {
    let id: String
    let prompt: String
    let options: [UserQuestionOption]
    let allowOther: Bool
}

struct UserQuestionOption: Codable, Equatable, Identifiable {
    var id: String { label }
    let label: String
    let description: String?
}

struct UserQuestionAnswer: Codable, Equatable {
    let questionId: String
    let answer: String
}

struct ProjectTaskControlTask: Codable, Equatable {
    let id: String
    let projectId: String
    let workspaceId: String
    let objective: String
    let status: String
    let blockedReason: String?
    let blockedDetail: String?
    let conversationId: String?
    let runId: String?
}

struct ProjectTaskDetailResponse: Codable, Equatable {
    let task: ProjectTaskControlTask
    let interaction: ProjectTaskInteraction?
    let activity: ProjectTaskActivityTimeline
    let plan: ProjectTaskPlanEvidence?
}

struct ProjectTaskPlanEvidence: Codable, Equatable {
    let protocolVersion: Int
    let id: String
    let status: String
    let stages: [ProjectTaskStageEvidence]
    let resume: ProjectTaskResumeCapability
}

struct ProjectTaskResumeCapability: Codable, Equatable {
    let supported: Bool
    let reason: String?
}

struct ProjectTaskStageEvidence: Codable, Equatable, Identifiable {
    let id: String
    let flowStageId: String?
    let name: String
    let status: String
    let attempts: [ProjectTaskStageAttempt]
    let outputs: [ProjectTaskStageOutput]
}

struct ProjectTaskStageAttempt: Codable, Equatable, Identifiable {
    let id: String
    let runId: String
    let conversationId: String
    let attempt: Int
    let status: String
    let terminalReason: String?
    let provenance: OutputProvenance
    let outputs: [ProjectTaskStageOutput]
    let usage: ChatRunUsage?
}

struct ProjectTaskStageOutput: Codable, Equatable, Identifiable {
    let id: String
    let title: String
    let kind: String
    let status: String
}

struct ProjectTaskActivityTimeline: Codable, Equatable {
    let protocolVersion: Int
    let projectId: String
    let taskId: String
    let items: [ProjectTaskActivityItem]
}

struct ProjectTaskActivityItem: Codable, Equatable, Identifiable {
    let protocolVersion: Int
    let id: String
    let projectId: String
    let taskId: String
    let runId: String?
    let type: String
    let category: String
    let status: String
    let title: String
    let detail: String?
    let items: [String]
    let occurredAt: String
    let sourceId: String?
    let actionable: Bool
    let terminal: Bool

    var isSupported: Bool {
        protocolVersion == 1
    }
}

struct ProjectTaskResponse: Codable, Equatable {
    let task: ProjectTaskControlTask
}

struct AnswerProjectTaskQuestionsRequest: Encodable {
    let interactionId: String
    let answers: [UserQuestionAnswer]
}

struct ResolveProjectTaskApprovalRequest: Encodable {
    let interactionId: String
    let resolution: String
}

struct ProjectTaskDestination: Equatable {
    let workspaceId: String
    let projectId: String
    let taskId: String
    let conversationId: String?
}
