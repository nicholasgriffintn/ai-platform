import Foundation

@MainActor
final class CompanionSync {
    private let client: DeviceSyncClient
    private let conversations: ConversationManager
    private let attention: AttentionStore
    private let inbox: TaskNotificationManager
    private let discover: DiscoverStore
    private let work: WorkStore
    private var pending: [String: Task<Void, Never>] = [:]

    init(
        client: DeviceSyncClient,
        conversations: ConversationManager,
        attention: AttentionStore,
        inbox: TaskNotificationManager,
        discover: DiscoverStore,
        work: WorkStore
    ) {
        self.client = client
        self.conversations = conversations
        self.attention = attention
        self.inbox = inbox
        self.discover = discover
        self.work = work

        client.onEvent = { [weak self] event in
            self?.handle(event)
        }
        client.onReconnect = { [weak self] in
            self?.refreshEverything()
        }
    }

    func handle(_ event: DeviceSyncEvent) {
        switch event.type {
        case "conversation.changed", "response.changed", "response.event", "message.changed":
            if let conversationId = event.string("conversationId") {
                debounce("conversation:\(conversationId)") { [conversations] in
                    await conversations.conversationChangedRemotely(id: conversationId)
                }
            }
            if event.type != "response.event" {
                refreshConversationList(projectId: event.string("projectId"))
            }
        case "conversation.unread_changed":
            refreshConversationList(projectId: event.string("projectId"))
        case "conversation.deleted":
            if let conversationId = event.string("conversationId") {
                conversations.conversationDeletedRemotely(id: conversationId)
            }
        case "project_task.changed", "attention.changed", "task.changed", "workbench_run.changed":
            refreshAttention()
        case "connector_approval.changed":
            refreshAttention()
            debounce("connector-approval") { [conversations] in
                await conversations.refreshCurrentConnectorApproval()
            }
        case "discover.changed":
            debounce("discover") { [discover] in
                await discover.refresh()
            }
        default:
            break
        }
    }

    func refreshEverything() {
        refreshConversationList(projectId: nil)
        refreshAttention()
        debounce("current-conversation") { [conversations] in
            await conversations.refreshCurrentConversation()
        }
    }

    private func refreshConversationList(projectId: String?) {
        debounce("conversation-list", delay: .seconds(1)) { [conversations] in
            await conversations.refreshConversations()
        }
        if let projectId {
            debounce("project:\(projectId)", delay: .seconds(1)) { [work] in
                await work.loadConversations(projectId: projectId)
            }
        }
    }

    private func refreshAttention() {
        debounce("attention", delay: .seconds(1)) { [attention, inbox] in
            await inbox.refresh()
            await attention.refresh(inboxUnread: inbox.unread)
        }
    }

    private func debounce(
        _ key: String,
        delay: Duration = .milliseconds(400),
        _ operation: @escaping @MainActor () async -> Void
    ) {
        pending[key]?.cancel()
        pending[key] = Task {
            try? await Task.sleep(for: delay)
            guard !Task.isCancelled else { return }
            await operation()
        }
    }
}
