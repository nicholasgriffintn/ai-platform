import SwiftUI

struct ModelSelectorView: View {
    var onSelectModel: ((String) -> Void)?

    @EnvironmentObject var modelsStore: ModelsStore
    @Environment(\.dismiss) private var dismiss
    
    @State private var searchText = ""
    @State private var showingFeaturedOnly = true
    @State private var showingDeprecated = false
    @State private var selectedProvider: String?
    @State private var showingError = false
    
    var filteredModels: [ModelConfigItem] {
        var models = modelsStore.searchModels(query: searchText)

        if showingFeaturedOnly {
            models = models.filter { $0.isFeatured == true }
        }

        if !showingDeprecated {
            models = models.filter { $0.isDeprecated != true }
        }

        if let selectedProvider {
            models = models.filter { $0.provider == selectedProvider }
        }

        return models
    }

    var availableProviders: [String] {
        Array(Set(modelsStore.models.map(\.provider))).sorted()
    }
    
    var modelsByProvider: [String: [ModelConfigItem]] {
        Dictionary(grouping: filteredModels, by: { $0.provider })
    }
    
    var body: some View {
        NavigationView {
            VStack {
                if modelsStore.isLoading {
                    ProgressView("Loading models...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if modelsStore.models.isEmpty {
                    VStack(spacing: 20) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.system(size: 50))
                            .foregroundColor(.orange)
                        
                        Text("No models available")
                            .font(.headline)
                        
                        Text("Unable to load AI models. Please check your connection and try again.")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                        
                        Button("Retry") {
                            Task {
                                await modelsStore.refreshModels()
                            }
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    VStack(spacing: 0) {
                        filterBar

                        if filteredModels.isEmpty {
                            ContentUnavailableView(
                                "No models found",
                                systemImage: "magnifyingglass",
                                description: Text(emptyStateDescription)
                            )
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                        } else {
                            List {
                                ForEach(modelsByProvider.keys.sorted(), id: \.self) { provider in
                                    Section {
                                        ForEach(modelsByProvider[provider] ?? [], id: \.id) { model in
                                            ModelRow(
                                                model: model,
                                                isSelected: model.id == modelsStore.selectedModelId
                                            ) {
                                                modelsStore.selectModel(model.id)
                                                onSelectModel?(model.id)
                                                dismiss()
                                            }
                                        }
                                    } header: {
                                        HStack {
                                            ModelIconView(
                                                modelName: provider,
                                                provider: provider,
                                                size: 16
                                            )
                                            Text(provider)
                                            Spacer()
                                            Text("\(modelsByProvider[provider]?.count ?? 0)")
                                                .font(.caption)
                                                .foregroundColor(.secondary)
                                        }
                                    }
                                }
                            }
                            .refreshable {
                                await modelsStore.refreshModels()
                            }
                        }
                    }
                    .searchable(text: $searchText, prompt: "Search models...")
                }
            }
            .navigationTitle("Select Model")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
        .alert("Error", isPresented: $showingError) {
            Button("OK") { }
        } message: {
            Text(modelsStore.error ?? "Unknown error occurred")
        }
        .onAppear {
            if modelsStore.models.isEmpty {
                Task {
                    await modelsStore.fetchModels()
                }
            }
        }
        .onChange(of: modelsStore.error) { _, newValue in
            showingError = newValue != nil
        }
    }

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                Toggle(isOn: $showingFeaturedOnly) {
                    Label("Featured", systemImage: "star.fill")
                }
                .toggleStyle(.button)
                .buttonStyle(.bordered)

                Menu {
                    Picker("Provider", selection: $selectedProvider) {
                        Text("All Providers").tag(String?.none)

                        ForEach(availableProviders, id: \.self) { provider in
                            Text(provider).tag(String?.some(provider))
                        }
                    }
                } label: {
                    Label(selectedProvider ?? "All Providers", systemImage: "building.2")
                }
                .buttonStyle(.bordered)

                Toggle(isOn: $showingDeprecated) {
                    Label("Deprecated", systemImage: showingDeprecated ? "eye" : "eye.slash")
                }
                .toggleStyle(.button)
                .buttonStyle(.bordered)
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
        .background(Color(.systemGroupedBackground))
    }

    private var emptyStateDescription: String {
        if !searchText.isEmpty {
            return "Try a different search term or adjust your filters."
        }

        return "Adjust your filters to include more models."
    }
}

struct ModelRow: View {
    let model: ModelConfigItem
    let isSelected: Bool
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack(alignment: .top, spacing: 12) {
                ModelIconView(
                    modelName: model.name ?? model.id,
                    provider: model.provider,
                    size: 32
                )
                .padding(.top, 1)

                VStack(alignment: .leading, spacing: 6) {
                    Text(model.name ?? model.id)
                        .font(.headline)
                        .foregroundColor(.primary)
                        .lineLimit(1)

                    if let description = model.description {
                        Text(description)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(2)
                    }

                    if let strengths = model.strengths, !strengths.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 4) {
                                ForEach(strengths.prefix(3), id: \.self) { strength in
                                    Text(strength)
                                        .font(.caption2)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Color.blue.opacity(0.1))
                                        .foregroundColor(.blue)
                                        .cornerRadius(4)
                                }
                            }
                        }
                    }

                    HStack(spacing: 8) {
                        if model.isFeatured == true {
                            CapabilityBadge(icon: "star.fill", text: "Featured", color: .yellow)
                        }

                        if model.isDeprecated == true {
                            CapabilityBadge(icon: "exclamationmark.triangle", text: "Deprecated", color: .orange)
                        }

                        if model.supportsFunctions == true {
                            CapabilityBadge(icon: "function", text: "Functions", color: .green)
                        }

                        if model.multimodal == true {
                            CapabilityBadge(icon: "photo", text: "Vision", color: .purple)
                        }

                        if let contextWindow = model.contextWindow {
                            CapabilityBadge(icon: "doc.text", text: "\(contextWindow/1000)k", color: .secondary)
                        }
                    }
                }

                Spacer()

                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.blue)
                        .font(.title2)
                }
            }
            .padding(.vertical, 8)
        }
        .buttonStyle(PlainButtonStyle())
        .accessibilityLabel("\\(model.name ?? model.id) from \\(model.provider)")
        .accessibilityHint(isSelected ? "Currently selected" : "Tap to select this model")
    }
}

struct CapabilityBadge: View {
    let icon: String
    let text: String
    let color: Color

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: icon)
                .font(.caption2)
            Text(text)
                .font(.caption2)
        }
        .foregroundColor(color)
    }
}

#Preview {
    ModelSelectorView()
        .environmentObject(ModelsStore())
}
