import Foundation
import SwiftUI

@MainActor
class ModelsStore: ObservableObject {
    @Published var models: [ModelConfigItem] = []
    @Published var selectedModelId: String? = nil
    @Published var isLoading: Bool = false
    @Published var error: String? = nil
    
    private let apiClient: APIClient
    private let userDefaults = UserDefaults.standard
    private let selectedModelKey = "selectedModelId"
    
    init(apiClient: APIClient = APIClient.shared) {
        self.apiClient = apiClient
        loadSelectedModel()
    }
    
    func fetchModels() async {
        isLoading = true
        error = nil
        
        do {
            let response = try await apiClient.fetchModels()
            // Convert dictionary to array, using the key as the id
            models = response.data.map { (key, model) in
                ModelConfigItem(
                    id: key,
                    name: model.name ?? key,
                    provider: model.provider,
                    description: model.description,
                    strengths: model.strengths,
                    contextWindow: model.contextWindow,
                    pricing: model.pricing,
                    modalities: model.modalities,
                    supportsFunctions: model.supportsFunctions,
                    multimodal: model.multimodal
                )
            }
            
            // If no model is selected, select the first available model
            if selectedModelId == nil && !models.isEmpty {
                selectModel(models[0].id)
            }
        } catch {
            self.error = "Failed to fetch models: \(error.localizedDescription)"
        }
        
        isLoading = false
    }
    
    func selectModel(_ modelId: String) {
        selectedModelId = modelId
        saveSelectedModel()
    }
    
    func getSelectedModel() -> ModelConfigItem? {
        guard let selectedModelId = selectedModelId else { return nil }
        return models.first { $0.id == selectedModelId }
    }
    
    func refreshModels() async {
        await fetchModels()
    }
    
    private func loadSelectedModel() {
        selectedModelId = userDefaults.string(forKey: selectedModelKey)
    }
    
    private func saveSelectedModel() {
        if let selectedModelId = selectedModelId {
            userDefaults.set(selectedModelId, forKey: selectedModelKey)
        } else {
            userDefaults.removeObject(forKey: selectedModelKey)
        }
    }
    
    func getModelsByProvider() -> [String: [ModelConfigItem]] {
        Dictionary(grouping: models, by: { $0.provider })
    }
    
    func searchModels(query: String) -> [ModelConfigItem] {
        if query.isEmpty {
            return models
        }
        return models.filter { model in
            (model.name ?? model.id).lowercased().contains(query.lowercased()) ||
            model.provider.lowercased().contains(query.lowercased()) ||
            (model.modalities?.input.contains { $0.lowercased().contains(query.lowercased()) } == true) ||
            (model.modalities?.output?.contains { $0.lowercased().contains(query.lowercased()) } == true) ||
            (model.strengths?.contains { $0.lowercased().contains(query.lowercased()) } == true) ||
            (model.description?.lowercased().contains(query.lowercased()) == true)
        }
    }
}
