import Foundation

enum ModelSearch {
    static func filter(_ models: [ModelConfigItem], query: String) -> [ModelConfigItem] {
        let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalizedQuery.isEmpty else {
            return models
        }

        return models.filter { model in
            matches(model, normalizedQuery: normalizedQuery)
        }
    }

    private static func matches(_ model: ModelConfigItem, normalizedQuery: String) -> Bool {
        (model.name ?? model.id).lowercased().contains(normalizedQuery) ||
            model.provider.lowercased().contains(normalizedQuery) ||
            (model.modalities?.input.contains { $0.lowercased().contains(normalizedQuery) } == true) ||
            (model.modalities?.output?.contains { $0.lowercased().contains(normalizedQuery) } == true) ||
            (model.strengths?.contains { $0.lowercased().contains(normalizedQuery) } == true) ||
            (model.description?.lowercased().contains(normalizedQuery) == true)
    }
}

struct ModelSelectionFilter {
    var searchText: String = ""
    var showsFeaturedOnly = true
    var showsDeprecated = false
    var selectedProvider: String?

    func apply(to models: [ModelConfigItem]) -> [ModelConfigItem] {
        var filtered = ModelSearch.filter(models, query: searchText)

        if showsFeaturedOnly {
            filtered = filtered.filter { $0.isFeatured == true }
        }

        if !showsDeprecated {
            filtered = filtered.filter { $0.isDeprecated != true }
        }

        if let selectedProvider {
            filtered = filtered.filter { $0.provider == selectedProvider }
        }

        return filtered
    }

    static func availableProviders(in models: [ModelConfigItem]) -> [String] {
        Array(Set(models.map(\.provider))).sorted()
    }

    var emptyStateDescription: String {
        if !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "Try a different search term or adjust your filters."
        }

        return "Adjust your filters to include more models."
    }
}
