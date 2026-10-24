import SwiftUI

enum ChatsMode: String, CaseIterable, Identifiable {
    case chat
    case work

    var id: String { rawValue }

    var title: String {
        switch self {
        case .chat: return "Chat"
        case .work: return "Work"
        }
    }
}

enum ChatsRoute: Hashable {
    case conversation(String)
    case project(String)
}

struct ChatsView: View {
    @EnvironmentObject private var conversationManager: ConversationManager
    @EnvironmentObject private var workStore: WorkStore
    @Binding var path: [ChatsRoute]
    @Binding var mode: ChatsMode
    @State private var searchText = ""
    @State private var pendingDeletion: Conversation?
    @State private var pendingRename: Conversation?
    @State private var renameTitle = ""

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                switch mode {
                case .chat:
                    chatList
                case .work:
                    WorkProjectsList(onOpenProject: { path.append(.project($0.id)) })
                }
            }
            .background(Color.polychat.background)
            .navigationTitle("Chats")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Picker("Mode", selection: $mode) {
                        ForEach(ChatsMode.allCases) { mode in
                            Text(mode.title).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 200)
                }
                if mode == .chat {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            let conversation = conversationManager.startNewConversation()
                            path.append(.conversation(conversation.id))
                        } label: {
                            Image(systemName: "square.and.pencil")
                        }
                        .accessibilityLabel("New chat")
                    }
                }
            }
            .navigationDestination(for: ChatsRoute.self) { route in
                switch route {
                case .conversation(let id):
                    ConversationScreen(conversationId: id, path: $path)
                case .project(let id):
                    ProjectConversationsView(projectId: id, path: $path)
                }
            }
        }
    }

    private var filteredConversations: [Conversation] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else {
            return conversationManager.conversations
        }
        return conversationManager.conversations.filter { $0.title.localizedCaseInsensitiveContains(query) }
    }

    private var chatList: some View {
        List {
            if let error = conversationManager.error, conversationManager.conversations.isEmpty {
                InlineErrorBanner(message: error) {
                    Task { await conversationManager.refreshConversations() }
                }
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            }

            ForEach(ConversationListSectionBuilder.sections(for: filteredConversations)) { section in
                Section(section.title) {
                    ForEach(section.conversations) { conversation in
                        NavigationLink(value: ChatsRoute.conversation(conversation.id)) {
                            ConversationRow(
                                conversation: conversation,
                                isStreaming: conversationManager.isStreaming(conversation.id)
                            )
                        }
                        .listRowBackground(Color.polychat.surface)
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button(role: .destructive) {
                                pendingDeletion = conversation
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                            Button {
                                renameTitle = conversation.title
                                pendingRename = conversation
                            } label: {
                                Label("Rename", systemImage: "pencil")
                            }
                            .tint(Color.polychat.primary)
                        }
                    }
                }
            }

            if filteredConversations.isEmpty && !conversationManager.isLoading {
                ContentUnavailableView(
                    searchText.isEmpty ? "No chats yet" : "No matches",
                    systemImage: searchText.isEmpty ? "bubble.left.and.bubble.right" : "magnifyingglass",
                    description: Text(searchText.isEmpty ? "Start one here or on any other device." : "Try a different title.")
                )
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .searchable(text: $searchText, prompt: "Search chats")
        .refreshable { await conversationManager.refreshConversations() }
        .overlay {
            if conversationManager.isLoading && conversationManager.conversations.isEmpty {
                ProgressView()
            }
        }
        .confirmationDialog(
            "Delete this chat?",
            isPresented: Binding(get: { pendingDeletion != nil }, set: { if !$0 { pendingDeletion = nil } }),
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                if let conversation = pendingDeletion {
                    Task { await conversationManager.deleteConversation(conversation) }
                }
                pendingDeletion = nil
            }
        } message: {
            Text("It disappears from Polychat on every device.")
        }
        .alert(
            "Rename chat",
            isPresented: Binding(get: { pendingRename != nil }, set: { if !$0 { pendingRename = nil } })
        ) {
            TextField("Title", text: $renameTitle)
            Button("Cancel", role: .cancel) { pendingRename = nil }
            Button("Save") {
                let title = renameTitle.trimmingCharacters(in: .whitespacesAndNewlines)
                if let conversation = pendingRename, !title.isEmpty {
                    Task { await conversationManager.updateConversationTitle(conversation.id, title: title) }
                }
                pendingRename = nil
            }
        }
    }
}

struct ConversationRow: View {
    let conversation: Conversation
    let isStreaming: Bool

    var body: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    if conversation.isPinned {
                        Image(systemName: "pin.fill")
                            .font(.caption2)
                            .foregroundStyle(Color.polychat.textMuted)
                    }
                    Text(conversation.title)
                        .font(.body.weight(conversation.isUnread ? .semibold : .regular))
                        .foregroundStyle(Color.polychat.text)
                        .lineLimit(1)
                }
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(Color.polychat.textMuted)
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            if isStreaming || conversation.latestResponse?.isActive == true {
                ProgressView().controlSize(.small)
            } else if conversation.isUnread {
                Circle()
                    .fill(Color.polychat.primary)
                    .frame(width: 8, height: 8)
                    .accessibilityLabel("Unread")
            }
        }
        .padding(.vertical, 2)
    }

    private var subtitle: String {
        RelativeTime.label(for: conversation.lastMessageAt ?? conversation.createdAt)
    }
}

private struct ConversationScreen: View {
    @EnvironmentObject private var conversationManager: ConversationManager
    @EnvironmentObject private var workStore: WorkStore
    let conversationId: String
    @Binding var path: [ChatsRoute]

    private var projectName: String? {
        conversationManager.currentConversation?.projectId.flatMap { projectId in
            workStore.projects.first { $0.id == projectId }?.name
        }
    }

    var body: some View {
        ChatView(projectName: projectName) { projectId in
            let conversation = conversationManager.startNewConversation(projectId: projectId)
            if !path.isEmpty {
                path[path.count - 1] = .conversation(conversation.id)
            }
        }
        .task(id: conversationId) {
            if conversationManager.currentConversation?.id != conversationId {
                await conversationManager.loadConversationMessages(id: conversationId)
            }
        }
    }
}
