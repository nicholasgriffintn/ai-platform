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
                    RecipesView { starter in
                        showingRecipes = false
                        startRecipeConversation(starter)
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

    private func startRecipeConversation(_ starter: String) {
        let conversation = conversationManager.startNewConversation()
        selectedConversationID = conversation.id

        Task {
            do {
                try await conversationManager.addMessage(ChatMessage(role: "user", content: starter))
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


private struct RecipesView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var response: AssistantRecipesResponse?
    @State private var selectedKind = "all"
    @State private var selectedCategory = "All"
    @State private var searchText = ""
    @State private var isLoading = false
    @State private var installingRecipeID: String?
    @State private var errorMessage: String?

    let onStart: (String) -> Void

    private var recipes: [AssistantRecipe] {
        let allRecipes = response?.recipes ?? []
        return allRecipes.filter { recipe in
            let matchesKind = selectedKind == "all" || recipe.kind == selectedKind
            let matchesCategory = selectedCategory == "All" || recipe.category == selectedCategory
            let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
            let matchesSearch = query.isEmpty || [recipe.title, recipe.summary, recipe.description, recipe.category].joined(separator: " ").localizedCaseInsensitiveContains(query)
            return matchesKind && matchesCategory && matchesSearch
        }
    }

    private var categories: [String] {
        ["All"] + (response?.categories ?? [])
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && response == nil {
                    ProgressView("Loading recipes...")
                } else if let errorMessage {
                    ContentUnavailableView("Recipes unavailable", systemImage: "exclamationmark.triangle", description: Text(errorMessage))
                } else {
                    List {
                        Section {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("Assistant Recipes")
                                    .font(.largeTitle.bold())
                                Text("Set up integrations, automations, and proactive check-ins through a guided assistant chat.")
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.vertical, 8)
                        }
                        .listRowBackground(Color.clear)

                        Section {
                            Picker("Type", selection: $selectedKind) {
                                Text("All").tag("all")
                                Text("Automate").tag("automate")
                                Text("Integrate").tag("integrate")
                            }
                            .pickerStyle(.segmented)

                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack {
                                    ForEach(categories, id: \.self) { category in
                                        Button {
                                            selectedCategory = category
                                        } label: {
                                            Text(category)
                                                .font(.caption.weight(.semibold))
                                                .padding(.horizontal, 12)
                                                .padding(.vertical, 7)
                                                .background(selectedCategory == category ? Color.polychat.primary.opacity(0.16) : Color.secondary.opacity(0.10))
                                                .clipShape(Capsule())
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                                .padding(.vertical, 4)
                            }
                        }

                        Section {
                            ForEach(recipes) { recipe in
                                RecipeRow(
                                    recipe: recipe,
                                    isInstalling: installingRecipeID == recipe.id,
                                    onInstall: {
                                        install(recipe)
                                    }
                                )
                            }
                        }
                    }
                    .searchable(text: $searchText, prompt: "Search recipes")
                    .refreshable {
                        await loadRecipes()
                    }
                }
            }
            .navigationTitle("Recipes")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
            .task {
                await loadRecipes()
            }
        }
    }

    private func loadRecipes() async {
        isLoading = true
        errorMessage = nil
        do {
            response = try await APIClient.shared.fetchAssistantRecipes()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func install(_ recipe: AssistantRecipe) {
        installingRecipeID = recipe.id
        Task {
            do {
                let setup = try await APIClient.shared.installAssistantRecipe(id: recipe.id)
                installingRecipeID = nil
                onStart(setup.conversationStarter)
            } catch {
                installingRecipeID = nil
                errorMessage = error.localizedDescription
            }
        }
    }
}

private struct RecipeRow: View {
    let recipe: AssistantRecipe
    let isInstalling: Bool
    let onInstall: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(recipe.title)
                        .font(.headline)
                    Text(recipe.summary)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if recipe.featured {
                    Text("Featured")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(.orange)
                }
            }

            Text(recipe.description)
                .font(.footnote)
                .foregroundStyle(.secondary)

            HStack {
                Label("\(recipe.estimatedSetupMinutes) min", systemImage: "clock")
                Label(recipe.category, systemImage: recipe.kind == "automate" ? "wand.and.stars" : "puzzlepiece.extension")
            }
            .font(.caption)
            .foregroundStyle(.secondary)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack {
                    ForEach(recipe.integrations) { integration in
                        Text(integration.name)
                            .font(.caption.weight(.medium))
                            .padding(.horizontal, 9)
                            .padding(.vertical, 5)
                            .background(Color.secondary.opacity(0.10))
                            .clipShape(Capsule())
                    }
                }
            }

            Button(action: onInstall) {
                if isInstalling {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                } else {
                    Label("Set up in chat", systemImage: "message.badge")
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isInstalling)
        }
        .padding(.vertical, 8)
    }
}
