import SwiftUI

struct ModelSelectorView: View {
    @EnvironmentObject var modelsStore: ModelsStore
    @Environment(\.dismiss) private var dismiss
    
    @State private var searchText = ""
    @State private var showingError = false
    
    var filteredModels: [ModelConfigItem] {
        modelsStore.searchModels(query: searchText)
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
                } else if filteredModels.isEmpty && !searchText.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 50))
                            .foregroundColor(.gray)
                        Text("No models found")
                            .font(.headline)
                        Text("Try a different search term")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
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
                                        dismiss()
                                    }
                                }
                            } header: {
                                HStack {
                                    Text(provider)
                                    Spacer()
                                    Text("\(modelsByProvider[provider]?.count ?? 0)")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                    }
                    .searchable(text: $searchText, prompt: "Search models...")
                    .refreshable {
                        await modelsStore.refreshModels()
                    }
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
        .onChange(of: modelsStore.error) { error in
            showingError = error != nil
        }
    }
}

struct ModelRow: View {
    let model: ModelConfigItem
    let isSelected: Bool
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 12) {
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