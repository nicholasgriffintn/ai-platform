import SwiftUI

struct ChatTranscriptView: View {
    @EnvironmentObject private var conversationManager: ConversationManager
    @EnvironmentObject private var activeConversation: ActiveConversationStore
    let projectName: String?

    private var conversation: Conversation? {
        activeConversation.conversation
    }

    var body: some View {
        MessageListView(
            messages: conversation?.messages ?? [],
            response: conversation?.latestResponse,
            activityLabel: conversationManager.turnActivityLabel(for: conversation?.id),
            taskActivity: conversationManager.currentTaskActivity,
            taskInteraction: conversationManager.currentTaskInteraction,
            connectorApproval: conversationManager.currentConnectorApproval,
            isLoadingConversation: conversationManager.loadingConversationID == conversation?.id,
            hasMoreMessages: conversation?.hasMoreMessages == true,
            isLoadingEarlierMessages: conversationManager.isLoadingEarlierMessages,
            emptyState: AnyView(ChatEmptyState(projectName: projectName)),
            onLoadEarlierMessages: { Task { await conversationManager.loadEarlierMessages() } },
            onAnswerTaskQuestions: { answers in Task { await conversationManager.answerCurrentTaskQuestions(answers) } },
            onResolveTaskApproval: { resolution in Task { await conversationManager.resolveCurrentTaskApproval(resolution) } },
            onRefreshTaskInteraction: { Task { await conversationManager.refreshCurrentTaskInteraction() } },
            onResolveConnectorApproval: { resolution in Task { await conversationManager.resolveCurrentConnectorApproval(resolution) } },
            onContinueConnectorApproval: { Task { await conversationManager.continueCurrentConnectorApproval() } },
            onRefreshConnectorApproval: { Task { await conversationManager.refreshCurrentConnectorApproval() } },
            onRetry: { message in Task { await conversationManager.regenerateAssistantMessage(message.id) } },
            onEdit: { message, text in Task { await conversationManager.editUserMessage(message.id, text: text) } }
        )
        .id(conversation?.id)
    }
}

private struct ChatEmptyState: View {
    let projectName: String?

    var body: some View {
        VStack(spacing: 14) {
            PolyMark(size: 64)
            Text(projectName.map { "New conversation in \($0)" } ?? "What's on your mind?")
                .font(.polychatDisplay(.title2))
                .multilineTextAlignment(.center)
            Text(projectName == nil
                 ? "Ask anything. Replies sync with Polychat on your other devices."
                 : "Everyone in the project can see this conversation.")
                .font(.subheadline)
                .foregroundStyle(Color.polychat.textMuted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 120)
        .padding(.horizontal, 24)
    }
}
