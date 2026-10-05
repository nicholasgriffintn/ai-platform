import Foundation

@MainActor
final class ProjectFlowHistoryControl: ObservableObject {
    @Published private(set) var history: ProjectFlowHistory?
    @Published private(set) var error: String?
    @Published private(set) var isLoading = false

    func load(apiClient: APIClient, projectId: String, taskId: String, reset: Bool) async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let page = try await apiClient.fetchProjectFlowHistory(
                projectId: projectId,
                taskId: taskId,
                after: reset ? 0 : history?.nextCursor ?? 0
            )
            history = ProjectFlowHistory(
                events: reset ? page.events : (history?.events ?? []) + page.events,
                nextCursor: page.nextCursor,
                hasMore: page.hasMore
            )
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }
}
