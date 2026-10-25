import Foundation

enum PolyThread {
    static let teammateId = "platform-poly"

    static func ask(_ text: String, apiClient: APIClient = .shared) async throws -> String {
        try await apiClient.initialize()
        let agenda = try await apiClient.fetchPolyAgenda()
        let response = try await apiClient.createResponse(
            messages: [ChatMessage(role: "user", content: text)],
            modelId: nil,
            conversationId: agenda.conversationId,
            agentTeammateId: teammateId
        )
        return response.lastAssistantText ?? "Poly has it and will reply in its thread."
    }
}
