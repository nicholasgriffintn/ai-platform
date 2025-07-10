import AppIntents

struct ChatIntent: AppIntent {
    static var title: LocalizedStringResource = "Ask Polychat"
    static var description = IntentDescription("Ask Polychat a question and get an AI response")
    
    @Parameter(title: "Question")
    var prompt: String
    
    static var parameterSummary: some ParameterSummary {
        Summary("Ask Polychat \(\.$prompt)")
    }
    
    @MainActor
    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let apiClient = APIClient()
        try await apiClient.initialize()
        
        let response = try await apiClient.createChatCompletion(messages: [
            ChatMessage(role: "user", content: prompt)
        ])
        
        guard let answer = response.choices.first?.message.content else {
            throw NSError(domain: "com.polychat.app", code: 1, userInfo: [NSLocalizedDescriptionKey: "No response from AI"])
        }
        
        return .result(value: answer)
    }
}

struct ChatIntentShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: ChatIntent(),
            phrases: ["Ask \(applicationName) about \(\.$prompt)"],
            shortTitle: "Ask Polychat",
            systemImageName: "message.fill"
        )
    }
}
