import AppIntents

struct AskPolyIntent: AppIntent {
    static var title: LocalizedStringResource = "Ask Poly"
    static var description = IntentDescription(
        "Send something to Poly's own thread, where it keeps track of what you are working on."
    )

    @Parameter(title: "Message", inputOptions: String.IntentInputOptions(multiline: true))
    var message: String

    static var parameterSummary: some ParameterSummary {
        Summary("Ask Poly \(\.$message)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let text = message.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !text.isEmpty else {
            throw $message.needsValueError("What should Poly look at?")
        }

        let apiClient = APIClient.shared
        try await apiClient.initialize()
        let agenda = try await apiClient.fetchPolyAgenda()
        let response = try await apiClient.createResponse(
            messages: [ChatMessage(role: "user", content: text)],
            modelId: nil,
            conversationId: agenda.conversationId,
            agentTeammateId: PolyStore.teammateId
        )
        let answer = response.lastAssistantText ?? "Poly has it and will reply in its thread."

        return .result(value: answer, dialog: IntentDialog(stringLiteral: answer))
    }
}
