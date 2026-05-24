import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @EnvironmentObject var conversationManager: ConversationManager
    @EnvironmentObject var modelsStore: ModelsStore
    @EnvironmentObject var toolsStore: ToolsStore
    @State private var columnVisibility = NavigationSplitViewVisibility.doubleColumn
    @State private var selectedConversationID: String?
    @State private var showingSettings = false

    var body: some View {
        Group {
            if authManager.isLoading {
                LaunchLoadingView()
            } else if authManager.isAuthenticated {
                NavigationSplitView(columnVisibility: $columnVisibility) {
                    ConversationListView(selectedConversationID: $selectedConversationID)
                } detail: {
                    if conversationManager.currentConversation != nil {
                        ChatView()
                    } else {
                        EmptyConversationView()
                    }
                }
                .sheet(isPresented: $showingSettings) {
                    SettingsView()
                }
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            showingSettings = true
                        } label: {
                            Image(systemName: "gearshape")
                        }
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

                    Task {
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
