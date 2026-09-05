import Foundation

struct TaskInboxItem: Codable, Equatable, Identifiable {
    let id: String
    let kind: String
    let taskId: String
    let projectId: String
    let workspaceId: String
    let projectName: String
    let objective: String
    let detail: String?
    let conversationId: String?
    let since: String
    let requiresAction: Bool
    let isRead: Bool
    let readAt: String?
    let deepLink: String
}

struct TaskInboxResponse: Codable, Equatable {
    let items: [TaskInboxItem]
    let total: Int
    let unread: Int
}

struct TaskNotificationPreferences: Codable, Equatable {
    var enabled: Bool
    var decisions: Bool
    var failures: Bool
    var completions: Bool
    var assignments: Bool
}

struct TaskNotificationRegistration: Codable, Equatable, Identifiable {
    let id: String
    let installationId: String
    let platform: String
    let state: String
    let failureCode: String?
    let updatedAt: String
}

struct TaskNotificationSettings: Codable, Equatable {
    let protocolVersion: Int
    var preferences: TaskNotificationPreferences
    let registrations: [TaskNotificationRegistration]
    let webPushPublicKey: String?
}

struct UpdateTaskNotificationPreferencesRequest: Encodable {
    let enabled: Bool?
    let decisions: Bool?
    let failures: Bool?
    let completions: Bool?
    let assignments: Bool?

    init(
        enabled: Bool? = nil,
        decisions: Bool? = nil,
        failures: Bool? = nil,
        completions: Bool? = nil,
        assignments: Bool? = nil
    ) {
        self.enabled = enabled
        self.decisions = decisions
        self.failures = failures
        self.completions = completions
        self.assignments = assignments
    }
}

struct TaskInboxReceiptRequest: Encodable {
    let itemIds: [String]
}

struct TaskInboxMutationResponse: Decodable {
    let updated: Int
}
