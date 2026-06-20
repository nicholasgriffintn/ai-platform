import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @EnvironmentObject var conversationManager: ConversationManager
    @EnvironmentObject var modelsStore: ModelsStore
    @EnvironmentObject var toolsStore: ToolsStore
    @State private var columnVisibility = NavigationSplitViewVisibility.doubleColumn
    @State private var selectedConversationID: String?
    @State private var showingSettings = false
    @State private var showingRecipes = false
    @State private var conversationLoadTask: Task<Void, Never>?

    private var isLoadingSelectedConversation: Bool {
        guard let selectedConversationID else {
            return false
        }

        return conversationManager.currentConversation?.id != selectedConversationID ||
        conversationManager.loadingConversationID == selectedConversationID
    }

    var body: some View {
        Group {
            if authManager.isLoading {
                LaunchLoadingView()
            } else if authManager.isAuthenticated {
                NavigationSplitView(columnVisibility: $columnVisibility) {
                    ConversationListView(
                        selectedConversationID: $selectedConversationID,
                        onShowSettings: {
                            showingSettings = true
                        },
                        onShowRecipes: {
                            showingRecipes = true
                        }
                    )
                } detail: {
                    if conversationManager.currentConversation != nil {
                        ChatView()
                    } else if isLoadingSelectedConversation {
                        ConversationLoadingView()
                    } else {
                        EmptyConversationView()
                    }
                }
                .sheet(isPresented: $showingSettings) {
                    SettingsView()
                }
                .sheet(isPresented: $showingRecipes) {
                    RecipesView { setup in
                        showingRecipes = false
                        startRecipeConversation(setup)
                    }
                }
                .task(id: authManager.isAuthenticated) {
                    if authManager.isAuthenticated {
                        await conversationManager.loadConversations()
                        await modelsStore.fetchModels()
                        await toolsStore.fetchTools()
                    } else {
                        conversationManager.reset()
                        selectedConversationID = nil
                    }
                }
                .onChange(of: selectedConversationID) { _, conversationID in
                    guard let conversationID else {
                        return
                    }

                    conversationLoadTask?.cancel()
                    conversationLoadTask = Task {
                        await conversationManager.loadConversationMessages(id: conversationID)
                    }
                }
                .onChange(of: conversationManager.currentConversation?.id) { _, conversationID in
                    if selectedConversationID != conversationID {
                        selectedConversationID = conversationID
                    }
                }
            } else {
                LoginView()
            }
        }
        .onOpenURL { url in
            authManager.handleOpenURL(url)
        }
    }

    private func startRecipeConversation(_ setup: AssistantRecipeInstallResponse) {
        let conversation = conversationManager.startNewConversation()
        selectedConversationID = conversation.id

        Task {
            do {
                let settings = setup.enabledTools.isEmpty
                ? nil
                : ChatSettings(enabledTools: setup.enabledTools)
                try await conversationManager.addMessage(
                    ChatMessage(role: "user", content: setup.conversationStarter),
                    settings: settings
                )
            } catch {
                conversationManager.error = "Failed to start recipe: \(error.localizedDescription)"
            }
        }
    }
}

private struct ConversationLoadingView: View {
    var body: some View {
        VStack(spacing: 12) {
            ProgressView()
            Text("Loading conversation...")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.polychat.background)
    }
}

private struct LaunchLoadingView: View {
    var body: some View {
        VStack(spacing: 16) {
            PolychatLogoView(size: 74)
            ProgressView()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemBackground))
    }
}

private struct EmptyConversationView: View {
    @EnvironmentObject var conversationManager: ConversationManager

    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: "bubble.left.and.text.bubble.right")
                .font(.system(size: 52, weight: .regular))
                .foregroundStyle(Color.polychat.primary)
            VStack(spacing: 6) {
                Text("Conversation")
                    .font(.title2.weight(.semibold))
                Text("Start a new chat or choose one from the list.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            Button {
                _ = conversationManager.startNewConversation()
            } label: {
                Label("New Chat", systemImage: "square.and.pencil")
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground))
    }
}

#Preview {
    ContentView()
        .environmentObject(AuthenticationManager())
        .environmentObject(ConversationManager())
        .environmentObject(ModelsStore())
        .environmentObject(ToolsStore())
}
