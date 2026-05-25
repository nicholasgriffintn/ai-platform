import Foundation

@MainActor
final class ToolsStore: ObservableObject {
    @Published var tools: [ToolDefinition] = []
    @Published var isLoading = false
    @Published var error: String?

    private let apiClient: any ToolsAPIClient

    init(apiClient: any ToolsAPIClient = APIClient.shared) {
        self.apiClient = apiClient
    }

    func fetchTools() async {
        isLoading = true
        error = nil

        do {
            tools = try await apiClient.fetchTools()
        } catch {
            self.error = "Failed to fetch tools: \(error.localizedDescription)"
        }

        isLoading = false
    }
}
