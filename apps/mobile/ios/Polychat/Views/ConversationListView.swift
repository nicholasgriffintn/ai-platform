import SwiftUI

struct ConversationListView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @EnvironmentObject var conversationManager: ConversationManager
    @Binding var selectedConversationID: String?
    @State private var searchText = ""
    let onShowSettings: () -> Void

    init(
        selectedConversationID: Binding<String?>,
        onShowSettings: @escaping () -> Void = {}
    ) {
        self._selectedConversationID = selectedConversationID
        self.onShowSettings = onShowSettings
    }

    private var filteredConversations: [Conversation] {
        if searchText.isEmpty {
            return conversationManager.conversations
        }
        return conversationManager.conversations.filter { conversation in
            conversation.title.localizedCaseInsensitiveContains(searchText) ||
            conversation.messages.contains { message in
                message.textContent.localizedCaseInsensitiveContains(searchText)
            }
        }
    }

    private var categorizedConversations: [ConversationListSection] {
        ConversationListSectionBuilder.sections(for: filteredConversations)
    }

    var body: some View {
        ZStack {
            List(selection: $selectedConversationID) {
                ForEach(categorizedConversations) { section in
                    Section(header: Text(section.title.uppercased()).font(.caption.weight(.semibold)).foregroundStyle(.secondary)) {
                        ForEach(section.conversations) { conversation in
                            NavigationLink(value: conversation.id) {
                                ConversationRow(
                                    conversation: conversation,
                                    isSelected: conversation.id == selectedConversationID
                                )
                            }
                            .buttonStyle(PlainButtonStyle())
                            .listRowInsets(EdgeInsets(top: 3, leading: 8, bottom: 3, trailing: 8))
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                        }
                        .onDelete { offsets in
                            deleteConversations(from: section.conversations, at: offsets)
                        }
                    }
                }

                if filteredConversations.isEmpty && !searchText.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 40))
                            .foregroundColor(.gray)
                        Text("No conversations found")
                            .font(.headline)
                            .foregroundColor(.gray)
                        Text("Try a different search term")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)
                    .listRowBackground(Color.clear)
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .refreshable {
                await conversationManager.refreshConversations()
            }

            if conversationManager.isLoading && conversationManager.conversations.isEmpty {
                ProgressView("Loading conversations...")
                    .padding()
                    .background(Color.polychat.elevatedBackground)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
        }
        .background(Color.polychat.sidebarBackground)
        .toolbarBackground(Color.polychat.sidebarBackground, for: .navigationBar)
        .searchable(text: $searchText, prompt: "Search conversations...")
        .navigationTitle("Conversations")
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                PolychatLogoView(size: 28)
            }

            ToolbarItemGroup(placement: .topBarTrailing) {
                Button {
                    onShowSettings()
                } label: {
                    Image(systemName: "gearshape")
                }
                .accessibilityLabel("Settings")

                Button(action: startNewConversation) {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("New Conversation")
            }
        }
        .alert("Error", isPresented: .constant(conversationManager.error != nil)) {
            Button("OK") {
                conversationManager.error = nil
            }
        } message: {
            if let error = conversationManager.error {
                Text(error)
            }
        }
    }

    private func startNewConversation() {
        let conversation = conversationManager.startNewConversation()
        selectedConversationID = conversation.id
    }

    private func deleteConversations(from conversations: [Conversation], at offsets: IndexSet) {
        Task {
            for index in offsets {
                let conversation = conversations[index]
                await conversationManager.deleteConversation(conversation)
            }
        }
    }
}

struct ConversationRow: View {
    let conversation: Conversation
    let isSelected: Bool

    var body: some View {
        HStack(spacing: 8) {
            Text(conversation.title)
                .font(.body.weight(isSelected ? .semibold : .regular))
                .foregroundColor(.primary)
                .lineLimit(1)

            Spacer(minLength: 4)
        }
        .padding(.vertical, 9)
        .padding(.horizontal, 10)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(isSelected ? Color.polychat.elevatedBackground : Color.clear)
        )
        .contentShape(Rectangle())
    }

}

#Preview {
    @Previewable @StateObject var conversationManager = ConversationListPreviewData.conversationManager
    @Previewable @StateObject var authManager = AuthenticationManager()
    @Previewable @StateObject var modelsStore = ConversationListPreviewData.modelsStore
    @Previewable @StateObject var toolsStore = ToolsStore()
    @Previewable @State var selectedConversationID: String? = ConversationListPreviewData.selectedConversationID
    @Previewable @State var showingSettings = false

    NavigationSplitView {
        ConversationListView(
            selectedConversationID: $selectedConversationID,
            onShowSettings: {
                showingSettings = true
            }
        )
            .environmentObject(authManager)
            .environmentObject(conversationManager)
    } detail: {
        if conversationManager.currentConversation != nil {
            ChatView()
                .environmentObject(conversationManager)
                .environmentObject(modelsStore)
                .environmentObject(toolsStore)
                .environmentObject(APIClient.shared)
        } else {
            Text("Conversation")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.polychat.background)
        }
    }
    .environmentObject(authManager)
    .environmentObject(conversationManager)
    .environmentObject(modelsStore)
    .environmentObject(toolsStore)
    .sheet(isPresented: $showingSettings) {
        SettingsView()
            .environmentObject(authManager)
            .environmentObject(modelsStore)
    }
    .onChange(of: selectedConversationID) { _, conversationID in
        guard let conversationID else {
            conversationManager.currentConversation = nil
            return
        }

        if let conversation = conversationManager.conversations.first(where: { $0.id == conversationID }) {
            conversationManager.currentConversation = conversation
        }
    }
    .preferredColorScheme(.dark)
}

@MainActor
private enum ConversationListPreviewData {
    static let selectedConversationID = "preview-markdown-overview"

    static var conversationManager: ConversationManager {
        let manager = ConversationManager()
        manager.conversations = conversations
        manager.currentConversation = conversations.first { $0.id == selectedConversationID }
        return manager
    }

    static var modelsStore: ModelsStore {
        let store = ModelsStore()
        store.models = [
            ModelConfigItem(
                id: "deepseek-chat",
                name: "DeepSeek Chat",
                provider: "deepseek",
                description: "General purpose chat model.",
                strengths: ["Reasoning", "Code"],
                contextWindow: 64000,
                pricing: nil,
                modalities: nil,
                supportsFunctions: true,
                multimodal: false,
                isFeatured: true
            ),
            ModelConfigItem(
                id: "gpt-4o",
                name: "GPT-4o",
                provider: "openai",
                description: "Fast multimodal model for everyday work.",
                strengths: ["Vision", "Code", "Reasoning"],
                contextWindow: 128000,
                pricing: nil,
                modalities: nil,
                supportsFunctions: true,
                multimodal: true,
                isFeatured: true
            )
        ]
        store.selectModel("deepseek-chat")
        return store
    }

    private static var conversations: [Conversation] {
        [
            conversation(
                id: "preview-markdown-overview",
                title: "Markdown Overview",
                lastMessageAt: Date().addingTimeInterval(-4 * 60),
                messages: [
                    ChatMessage(role: "user", content: "Show me a representative markdown response."),
                    ChatMessage(role: "assistant", content: markdownOverview)
                ]
            ),
            conversation(
                id: "preview-code",
                title: "Code Blocks and Inline Code",
                lastMessageAt: Date().addingTimeInterval(-12 * 60),
                messages: [
                    ChatMessage(role: "user", content: "Render some code examples."),
                    ChatMessage(role: "assistant", content: codeExamples)
                ]
            ),
            conversation(
                id: "preview-tables",
                title: "Tables, Quotes and Rules",
                lastMessageAt: Date().addingTimeInterval(-24 * 60),
                messages: [
                    ChatMessage(role: "user", content: "Can you preview tables and block quotes?"),
                    ChatMessage(role: "assistant", content: tableAndQuoteExamples)
                ]
            ),
            conversation(
                id: "preview-tasks",
                title: "Task Lists and Nested Lists",
                lastMessageAt: Date().addingTimeInterval(-42 * 60),
                messages: [
                    ChatMessage(role: "user", content: "Make a checklist with nested notes."),
                    ChatMessage(role: "assistant", content: taskListExamples)
                ]
            ),
            conversation(
                id: "preview-streaming-markdown",
                title: "Streaming Partial Markdown",
                lastMessageAt: Date().addingTimeInterval(-58 * 60),
                messages: [
                    ChatMessage(role: "user", content: "What might the renderer see mid-stream?"),
                    ChatMessage(role: "assistant", content: streamingMarkdown)
                ]
            ),
            conversation(
                id: "preview-new",
                title: "New Conversation",
                lastMessageAt: Date().addingTimeInterval(-8 * 60),
                messages: [
                    ChatMessage(role: "user", content: "Can you help me plan the mobile layout?")
                ]
            ),
            conversation(
                id: "preview-swift",
                title: "SwiftUI Streaming Response",
                lastMessageAt: Date().addingTimeInterval(-35 * 60),
                messages: [
                    ChatMessage(role: "user", content: "Can SwiftUI render streamed markdown cleanly?"),
                    ChatMessage(role: "assistant", content: "Yes. Keep the message model updated as chunks arrive.")
                ]
            ),
            conversation(
                id: "preview-assistance",
                title: "Hello and Assistance",
                lastMessageAt: Date().addingTimeInterval(-2 * 60 * 60),
                messages: [
                    ChatMessage(role: "user", content: "Hello, what can you do?")
                ]
            ),
            conversation(
                id: "preview-technical",
                title: "Technical Challenge Discussion",
                lastMessageAt: Calendar.current.date(byAdding: .day, value: -1, to: Date()),
                messages: [
                    ChatMessage(role: "user", content: "Compare a few queue implementations.")
                ]
            ),
            conversation(
                id: "preview-france",
                title: "Capital of France",
                lastMessageAt: Calendar.current.date(byAdding: .day, value: -1, to: Date())?.addingTimeInterval(-90 * 60),
                messages: [
                    ChatMessage(role: "user", content: "What is the capital of France?")
                ]
            ),
            conversation(
                id: "preview-chair",
                title: "Standing Chair Design",
                lastMessageAt: Calendar.current.date(byAdding: .day, value: -3, to: Date()),
                messages: [
                    ChatMessage(role: "user", content: "Sketch a standing chair concept.")
                ]
            ),
            conversation(
                id: "preview-memes",
                title: "Memes Through The Years",
                lastMessageAt: Calendar.current.date(byAdding: .day, value: -8, to: Date()),
                messages: [
                    ChatMessage(role: "user", content: "Summarize internet memes by era.")
                ]
            ),
            conversation(
                id: "preview-older",
                title: "Robots Demand Coffee Breaks",
                lastMessageAt: Calendar.current.date(byAdding: .month, value: -2, to: Date()),
                messages: [
                    ChatMessage(role: "user", content: "Write a satirical news brief.")
                ]
            )
        ]
    }

    private static let markdownOverview = """
    # Release Notes Draft

    This response includes **bold text**, *italic text*, ~~removed text~~, inline `code`, and a [reference link](https://polychat.app).

    ## Highlights

    - Dark mode should keep contrast high.
    - Assistant messages should read like full-width prose.
    - User messages should stay compact and rounded.

    1. Parse the response.
    2. Preserve spacing.
    3. Keep code readable.

    The most important detail is that markdown should feel close to the web app, not like raw plain text.
    """

    private static let codeExamples = """
    Inline code such as `URLSession.shared.bytes(for:)` should sit comfortably inside prose.

    ```swift
    struct StreamedMessage: Identifiable {
        let id: String
        var content: String

        mutating func append(_ delta: String) {
            content += delta
        }
    }
    ```

    JSON payloads should keep indentation and horizontal scrolling:

    ```json
    {
      "model": "deepseek-chat",
      "stream": true,
      "messages": [
        { "role": "user", "content": "Preview markdown rendering" }
      ]
    }
    ```
    """

    private static let tableAndQuoteExamples = """
    ## Renderer Comparison

    | Feature | Web app | SwiftUI preview |
    | --- | --- | --- |
    | Fenced code | Highlighted with rehype | Monospaced block |
    | Tables | GFM table | Preview target |
    | Links | Clickable | Attributed markdown |
    | Streaming fixes | Completes partial tags | Shows partial content |

    > Good markdown previews should include awkward content, not just perfect paragraphs.
    > That makes spacing and contrast issues easier to catch.

    ---

    After the rule, normal prose should resume without odd gaps.
    """

    private static let taskListExamples = """
    ## Implementation Checklist

    - [x] Match sidebar density.
    - [x] Use the dark zinc palette.
    - [ ] Tune table rendering.
    - [ ] Verify markdown while streaming.

    Nested notes:

    - Conversation panel
      - Selected rows need a clear but quiet background.
      - Long titles should truncate without shifting the row height.
    - Chat thread
      - Assistant prose should use the full reading column.
      - User messages should cap their width.

    Definition-style content:

    **Reasoning:** keep the UI stable while chunks arrive.
    **Risk:** incomplete markdown can briefly contain unmatched fences or links.
    """

    private static let streamingMarkdown = """
    ## Streaming Response In Progress

    The web app completes incomplete markdown while a response is still arriving. The SwiftUI preview should make these cases visible:

    - An unfinished bold segment: **still arriving
    - An unfinished inline code segment: `partialValue
    - A table row that may receive more cells:

    | Step | Status |
    | --- | --- |
    | Parse chunk | Running

    ```swift
    func append(delta: String) {
        message.content += delta
    }
    """

    private static func conversation(
        id: String,
        title: String,
        lastMessageAt: Date?,
        messages: [ChatMessage]
    ) -> Conversation {
        Conversation(
            id: id,
            title: title,
            messages: messages,
            createdAt: lastMessageAt ?? Date(),
            modelId: "deepseek-chat",
            isLoadedFromAPI: false,
            lastMessageAt: lastMessageAt,
            messageCount: messages.count
        )
    }
}
