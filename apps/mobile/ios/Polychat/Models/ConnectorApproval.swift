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
}

struct ConnectorOperationApprovalResponse: Codable, Equatable {
    let approval: ConnectorOperationApproval
}

struct ConnectorApprovalResolution: Codable, Equatable {
    let id: String
    let state: String
}

struct ConnectorApprovalResolutionResponse: Codable, Equatable {
    let approval: ConnectorApprovalResolution
}

struct ResolveConnectorApprovalRequest: Encodable {
    let resolution: String
}

struct ConnectorApprovalCandidate: Equatable {
    let approvalId: String
    let runId: String
    let completionId: String
    let provider: String
    let operation: String

    static func latest(in messages: [ChatMessage], run: ChatRun) -> ConnectorApprovalCandidate? {
        for message in messages.reversed() where message.runId == nil || message.runId == run.id {
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
                    runId: run.id,
                    completionId: run.conversationId,
                    provider: provider,
                    operation: operation
                )
            }
        }

        return nil
    }
}
