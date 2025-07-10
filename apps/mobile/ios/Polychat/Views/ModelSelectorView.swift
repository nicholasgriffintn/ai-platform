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
                } else {
                    List {
                        ForEach(modelsByProvider.keys.sorted(), id: \.self) { provider in
                            Section(provider) {
                                ForEach(modelsByProvider[provider] ?? [], id: \.id) { model in
                                    ModelRow(
                                        model: model,
                                        isSelected: model.id == modelsStore.selectedModelId
                                    ) {
                                        modelsStore.selectModel(model.id)
                                        dismiss()
                                    }
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
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(model.name ?? model.id)
                        .font(.headline)
                        .foregroundColor(.primary)
                    
                    if let strengths = model.strengths, !strengths.isEmpty {
                        HStack {
                            ForEach(strengths.prefix(3), id: \.self) { strength in
                                Text(strength)
                                    .font(.caption)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 2)
                                    .background(Color.blue.opacity(0.1))
                                    .foregroundColor(.blue)
                                    .cornerRadius(4)
                            }
                        }
                    }
                    
                    HStack {
                        if model.supportsFunctions == true {
                            Label("Functions", systemImage: "function")
                                .font(.caption)
                                .foregroundColor(.green)
                        }
                        
                        if model.multimodal == true {
                            Label("Multimodal", systemImage: "photo")
                                .font(.caption)
                                .foregroundColor(.purple)
                        }
                        
                        if let contextWindow = model.contextWindow {
                            Text("\\(contextWindow/1000)k context")
                                .font(.caption)
                                .foregroundColor(.secondary)
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
            .padding(.vertical, 4)
        }
        .buttonStyle(PlainButtonStyle())
        .accessibilityLabel("\\(model.name ?? model.id) from \\(model.provider)")
        .accessibilityHint(isSelected ? "Currently selected" : "Tap to select this model")
    }
}

#Preview {
    ModelSelectorView()
        .environmentObject(ModelsStore())
}