import SwiftUI

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @EnvironmentObject var authManager: AuthenticationManager
    @EnvironmentObject var conversationManager: ConversationManager
    @EnvironmentObject var modelsStore: ModelsStore
    @EnvironmentObject var notificationManager: TaskNotificationManager
    @State private var columnVisibility = NavigationSplitViewVisibility.doubleColumn
    @State private var selectedConversationID: String?
    @State private var showingSettings = false
    @State private var showingRecipes = false
    @State private var showingInbox = false
    @State private var outputReviewTarget: OutputReviewTarget?
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
                        },
                        onShowInbox: {
                            showingInbox = true
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
                .sheet(isPresented: $showingInbox) {
                    TaskInboxView()
                }
                .sheet(item: $outputReviewTarget) { target in
                    OutputRevisionReviewView(outputId: target.id)
                }
                .task(id: authManager.isAuthenticated) {
                    if authManager.isAuthenticated {
                        await conversationManager.loadConversations()
                        await modelsStore.fetchModels()
                        await notificationManager.reconcileAuthenticatedState(isAuthenticated: true)
                    } else {
                        conversationManager.reset()
                        selectedConversationID = nil
                        await notificationManager.reconcileAuthenticatedState(isAuthenticated: false)
                    }
                }
                .onChange(of: notificationManager.requestedInboxItemId) { _, itemId in
                    if itemId != nil {
                        showingInbox = true
                    }
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active {
                        Task { await notificationManager.refresh() }
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
            notificationManager.handleDeepLink(url)
            if let outputId = OutputReviewDeepLink.outputId(from: url) {
                outputReviewTarget = OutputReviewTarget(id: outputId)
            }
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

private struct OutputReviewTarget: Identifiable {
    let id: String
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
        .environmentObject(TaskNotificationManager())
}
