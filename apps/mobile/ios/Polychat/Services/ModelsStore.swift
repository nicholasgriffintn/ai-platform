import Foundation
import SwiftUI

@MainActor
class ModelsStore: ObservableObject {
    @Published var models: [ModelConfigItem] = []
    @Published private(set) var machines: [MachineRecord] = []
    @Published var selectedModelId: String? = nil
    @Published var selectedModelTier: String? = nil
    @Published private(set) var tierModelIds: [String: String] = [:]
    @Published var isLoading: Bool = false
    @Published var error: String? = nil
    @Published var selectionIssue: String? = nil
    
    private let apiClient: any ModelsAPIClient
    private let userDefaults: UserDefaults
    private let selectedModelKey = "selectedModelId"
    private let selectedModelTierKey = "selectedModelTier"
    private var accountDefaultModelId: String?
    private var accountDefaultModelTier: String?
    private var accountDefaultComputeSite: String?
    
    init(apiClient: any ModelsAPIClient = APIClient.shared, userDefaults: UserDefaults = .standard) {
        self.apiClient = apiClient
        self.userDefaults = userDefaults
        loadSelectedModel()
    }
    
    func fetchModels() async {
        isLoading = true
        error = nil
        
        do {
            let response = try await apiClient.fetchModels()
            models = response.map { (key, model) in
                ModelConfigItem(
                    id: key,
                    name: model.name ?? key,
                    provider: model.provider,
                    description: model.description,
                    strengths: model.strengths,
                    contextWindow: model.contextWindow,
                    pricing: model.pricing,
                    modalities: model.modalities,
                    supportsToolCalls: model.supportsToolCalls,
                    multimodal: model.multimodal,
                    isFeatured: model.isFeatured,
                    deprecated: model.deprecated,
                    isDefault: model.isDefault,
                    isExecutable: model.isExecutable,
                    runsOn: model.runsOn,
                    machineId: model.machineId,
                    isPlatformEnabled: model.isPlatformEnabled,
                    isFree: model.isFree,
                    isByokEnabled: model.isByokEnabled,
                    readiness: model.readiness,
                    status: model.status,
                    supportsAttachments: model.supportsAttachments,
                    supportsDocuments: model.supportsDocuments,
                    supportsAudio: model.supportsAudio,
                    supportsImageEdits: model.supportsImageEdits,
                    supportsResponseFormat: model.supportsResponseFormat,
                    supportsRealtimeSession: model.supportsRealtimeSession,
                    supportedServiceTiers: model.supportedServiceTiers,
                    serviceTierMultipliers: model.serviceTierMultipliers
                )
            }

            if let tierResponse = try? await apiClient.fetchModelTiers(),
               let hostedLineup = tierResponse.runtimes["hosted"] {
                tierModelIds = [
                    "low": hostedLineup.modelId(for: "low"),
                    "medium": hostedLineup.modelId(for: "medium"),
                    "high": hostedLineup.modelId(for: "high"),
                    "ultra": hostedLineup.modelId(for: "ultra")
                ].compactMapValues { $0 }
            }

            machines = (try? await apiClient.fetchMachines()) ?? []
            let machineModels = machines.flatMap { machine in
                machine.runtimes.filter { $0.kind == "model" && $0.readiness.status == "ready" }.flatMap { runtime in
                    runtime.models.map { model in
                        ModelConfigItem(
                            id: "machine/\(machine.machineId)/\(runtime.vendor)/\(model.nativeId)",
                            name: model.displayName,
                            provider: runtime.vendor,
                            description: machine.online ? "Runs on \(machine.label)." : "\(machine.label) is offline.",
                            strengths: [],
                            contextWindow: model.contextTokens,
                            pricing: nil,
                            modalities: ModelConfigItem.ModelModalities(input: ["text"], output: ["text"]),
                            supportsToolCalls: false,
                            multimodal: false,
                            isFeatured: true,
                            isExecutable: machine.online && machine.capabilities.contains("model-relay"),
                            runsOn: "device",
                            machineId: machine.machineId,
                            isPlatformEnabled: machine.online,
                            isFree: false
                        )
                    }
                }
            }
            models.append(contentsOf: machineModels)

            let hasAccountDefaults = accountDefaultModelId != nil ||
                accountDefaultModelTier != nil ||
                accountDefaultComputeSite != nil
            let usedAccountDefaults = !hasLocalModelSelection && hasAccountDefaults
            if usedAccountDefaults {
                applyAccountSelection()
            }

            if selectedModelId == nil && selectedModelTier == nil {
                let defaultModel = models.first {
                    $0.isDefault == true &&
                    $0.isAvailableForSelection
                }
                selectModel(defaultModel?.id)
            } else if !usedAccountDefaults {
                updateSelectionIssue()
            }
        } catch {
            self.error = "Failed to fetch models: \(error.localizedDescription)"
        }
        
        isLoading = false
    }
    
    func selectModel(_ modelId: String?) {
        selectedModelId = modelId
        selectedModelTier = nil
        userDefaults.removeObject(forKey: selectedModelTierKey)
        updateSelectionIssue()
        saveSelectedModel()
    }

    func selectTier(_ tier: String) {
        guard tierModelIds[tier] != nil else { return }
        selectedModelId = nil
        selectedModelTier = tier
        userDefaults.removeObject(forKey: selectedModelKey)
        userDefaults.set(tier, forKey: selectedModelTierKey)
        updateSelectionIssue()
    }

    func applyAccountDefaults(_ settings: AuthUserSettings?) {
        accountDefaultModelId = settings?.defaultModelId
        accountDefaultModelTier = settings?.defaultModelTier
        accountDefaultComputeSite = settings?.defaultComputeSite

        if !hasLocalModelSelection && !models.isEmpty {
            applyAccountSelection()
        }
    }
    
    func getSelectedModel() -> ModelConfigItem? {
        guard let selectedModelId = selectedModelId else { return nil }
        return model(withId: selectedModelId)
    }

    func model(withId modelId: String) -> ModelConfigItem? {
        models.first { $0.id == modelId }
    }
    
    func refreshModels() async {
        await fetchModels()
    }
    
    private func loadSelectedModel() {
        selectedModelId = userDefaults.string(forKey: selectedModelKey)
        selectedModelTier = userDefaults.string(forKey: selectedModelTierKey)
    }

    private var hasLocalModelSelection: Bool {
        userDefaults.object(forKey: selectedModelKey) != nil ||
        userDefaults.object(forKey: selectedModelTierKey) != nil
    }

    private func applyAccountSelection() {
        let runtimeFallback = accountDefaultComputeSite.map { $0 != "hosted" } ?? false
        let accountModel = accountDefaultModelId.flatMap { model(withId: $0) }

        if let accountModel, accountModel.isAvailableForSelection, !runtimeFallback {
            selectedModelId = accountModel.id
            selectedModelTier = nil
            selectionIssue = nil
            return
        }

        if let accountDefaultModelTier, !runtimeFallback {
            selectedModelId = nil
            selectedModelTier = accountDefaultModelTier
            selectionIssue = nil
            return
        }

        let defaultModel = models.first {
            $0.isDefault == true && $0.isAvailableForSelection
        }
        selectedModelId = defaultModel?.id
        selectedModelTier = nil
        updateSelectionIssue()

        if runtimeFallback {
            let site = accountDefaultComputeSite ?? "another"
            selectionIssue = "Your account default uses \(site) compute, which this phone cannot reach. Using hosted compute instead."
        } else if accountDefaultModelId != nil {
            selectionIssue = "Your account default model is not available on this phone. Using the hosted default instead."
        }
    }
    
    private func saveSelectedModel() {
        if let selectedModelId = selectedModelId {
            userDefaults.set(selectedModelId, forKey: selectedModelKey)
        } else {
            userDefaults.removeObject(forKey: selectedModelKey)
        }
    }

    private func updateSelectionIssue() {
        guard let selectedModelId else {
            selectionIssue = nil
            return
        }

        guard let selectedModel = model(withId: selectedModelId) else {
            selectionIssue = "Your selected model is no longer available to this account. It was not replaced automatically."
            return
        }

        if let readiness = selectedModel.readiness {
            if !readiness.isFresh() {
                selectionIssue = "Model readiness has expired. Refresh models before sending."
            } else if !readiness.isReady {
                selectionIssue = readiness.reason
            } else {
                selectionIssue = nil
            }
            return
        }

        selectionIssue = selectedModel.isAvailableForSelection
            ? nil
            : "This model cannot run under the current account and provider policy."
    }
    
    func getModelsByProvider() -> [String: [ModelConfigItem]] {
        Dictionary(grouping: models, by: { $0.provider })
    }
    
    func searchModels(query: String) -> [ModelConfigItem] {
        ModelSearch.filter(models, query: query)
    }
}
