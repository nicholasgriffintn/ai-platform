import Foundation

struct ConnectorOperationApproval: Codable, Equatable {
    let id: String
    let runId: String
    let completionId: String
    let provider: String
    let operation: String
    let state: String
    let createdAt: String
    let expiresAt: String
    let resolvedAt: String?
    let consumedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, provider, operation, state
        case runId = "response_id"
        case completionId = "conversation_id"
        case createdAt = "created_at"
        case expiresAt = "expires_at"
        case resolvedAt = "resolved_at"
        case consumedAt = "consumed_at"
    }
}

struct ConnectorApprovalResolution: Codable, Equatable {
    let id: String
    let state: String
}

struct ResolveApprovalRequest: Encodable {
    let state: String
}

struct ConnectorApprovalCandidate: Equatable {
    let approvalId: String
    let runId: String
    let completionId: String
    let provider: String
    let operation: String

    static func latest(in messages: [ChatMessage], response: PlatformResponse) -> ConnectorApprovalCandidate? {
        for message in messages.reversed() where message.runId == nil || message.runId == response.id {
            for part in (message.parts ?? []).reversed() {
                guard part.type == "tool_result",
                      let data = part.data?.objectValue,
                      data["approvalRequired"]?.boolValue == true,
                      let approvalId = data["approvalId"]?.stringValue,
                      let provider = data["provider"]?.stringValue,
                      let operation = data["operation"]?.stringValue else {
                    continue
                }

                return ConnectorApprovalCandidate(
                    approvalId: approvalId,
                    runId: response.id,
                    completionId: response.conversationId,
                    provider: provider,
                    operation: operation
                )
            }
        }

        return nil
    }
}
