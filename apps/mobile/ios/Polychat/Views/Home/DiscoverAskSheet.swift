import SwiftUI

struct DiscoverAskRequest: Identifiable {
    let card: DiscoverCard
    let editionId: String

    var id: String { "\(editionId):\(card.id)" }
}

struct DiscoverAskSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var conversationManager: ConversationManager
    @EnvironmentObject private var ageGateStore: AgeGateStore
    @State private var started = false
    let request: DiscoverAskRequest

    var body: some View {
        NavigationStack {
            ChatView(projectName: nil) { projectId in
                _ = conversationManager.startNewConversation(projectId: projectId)
            }
            .navigationTitle(request.card.headline)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .task {
            guard !started else { return }
            started = true
            let subject = request.card.subject(editionId: request.editionId)
            if let conversationId = await conversationManager.latestConversationId(about: subject) {
                await conversationManager.loadConversationMessages(id: conversationId)
                return
            }
            _ = conversationManager.startNewConversation(subject: subject)
            guard await ageGateStore.ensureConfirmed() else { return }
            try? await conversationManager.addMessage(ChatMessage(role: "user", content: request.card.chatPrompt))
        }
    }
}
