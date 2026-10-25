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

        let answer = try await PolyThread.ask(text)
        return .result(value: answer, dialog: IntentDialog(stringLiteral: answer))
    }
}
