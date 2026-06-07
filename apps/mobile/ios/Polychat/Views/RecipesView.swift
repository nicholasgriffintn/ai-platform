import SwiftUI

struct RecipesView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var response: AssistantRecipesResponse?
    @State private var selectedKind = "all"
    @State private var selectedCategory = "All"
    @State private var searchText = ""
    @State private var isLoading = false
    @State private var installingRecipeID: String?
    @State private var errorMessage: String?

    let onStart: (AssistantRecipeInstallResponse) -> Void

    private var recipes: [AssistantRecipe] {
        let allRecipes = response?.recipes ?? []
        return allRecipes.filter { recipe in
            let matchesKind = selectedKind == "all" || recipe.kind == selectedKind
            let matchesCategory = selectedCategory == "All" || recipe.category == selectedCategory
            let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
            let searchableText = [
                recipe.title,
                recipe.summary,
                recipe.description,
                recipe.category
            ].joined(separator: " ")
            let matchesSearch = query.isEmpty || searchableText.localizedCaseInsensitiveContains(query)

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
                    ContentUnavailableView(
                        "Recipes unavailable",
                        systemImage: "exclamationmark.triangle",
                        description: Text(errorMessage)
                    )
                } else {
                    recipeList
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

    private var recipeList: some View {
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
                                    .background(categoryBackground(for: category))
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

    private func categoryBackground(for category: String) -> Color {
        selectedCategory == category
            ? Color.polychat.primary.opacity(0.16)
            : Color.secondary.opacity(0.10)
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
                onStart(setup)
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

    private var missingIntegrations: [AssistantRecipeIntegration] {
        recipe.integrations.filter { integration in
            integration.requiresConnection &&
                (integration.connectionStatus == "missing" || integration.connectionStatus == "unknown")
        }
    }

    private var supportsSchedule: Bool {
        recipe.triggers.contains { $0.type == "schedule" }
    }

    private var needsConfiguration: Bool {
        recipe.configurationFields.contains { $0.required }
    }

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
                            .background(integrationBackground(for: integration))
                            .clipShape(Capsule())
                    }
                }
            }

            if !missingIntegrations.isEmpty {
                Label("\(missingIntegrations.count) connection needed before external actions", systemImage: "key")
                    .font(.caption)
                    .foregroundStyle(.orange)
            }

            if supportsSchedule || needsConfiguration {
                HStack(spacing: 12) {
                    if supportsSchedule {
                        Label("Can be scheduled", systemImage: "calendar.badge.clock")
                    }
                    if needsConfiguration {
                        Label("Needs recipe details", systemImage: "slider.horizontal.3")
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
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

    private func integrationBackground(for integration: AssistantRecipeIntegration) -> Color {
        integration.connectionStatus == "connected"
            ? Color.green.opacity(0.16)
            : Color.secondary.opacity(0.10)
    }
}
