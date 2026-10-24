import Foundation

@MainActor
final class WorkStore: ObservableObject {
    private static let workspaceKey = "work.selectedWorkspaceId"

    @Published private(set) var workspaces: [WorkspaceSummary] = []
    @Published private(set) var projects: [ProjectSummary] = []
    @Published private(set) var conversationsByProject: [String: [ProjectConversation]] = [:]
    @Published private(set) var isLoading = false
    @Published private(set) var isUnavailable = false
    @Published var error: String?
    @Published var selectedWorkspaceId: String? = UserDefaults.standard.string(forKey: WorkStore.workspaceKey) {
        didSet {
            UserDefaults.standard.set(selectedWorkspaceId, forKey: Self.workspaceKey)
        }
    }

    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    var selectedWorkspace: WorkspaceSummary? {
        workspaces.first { $0.id == selectedWorkspaceId }
    }

    func refresh() async {
        isLoading = true
        defer { isLoading = false }

        do {
            workspaces = try await apiClient.fetchWorkspaces()
            isUnavailable = false
            if selectedWorkspace == nil {
                selectedWorkspaceId = workspaces.first?.id
            }
            try await loadProjects()
            error = nil
        } catch APIClientError.httpStatus(let status, _) where status == 402 || status == 403 {
            workspaces = []
            projects = []
            isUnavailable = true
        } catch is CancellationError {
            return
        } catch {
            self.error = "Work could not be loaded: \(error.localizedDescription)"
        }
    }

    func select(_ workspaceId: String) async {
        guard workspaceId != selectedWorkspaceId else { return }
        selectedWorkspaceId = workspaceId
        projects = []
        do {
            try await loadProjects()
        } catch {
            self.error = "Projects could not be loaded: \(error.localizedDescription)"
        }
    }

    func loadConversations(projectId: String) async {
        do {
            let project = try await apiClient.fetchProject(id: projectId)
            conversationsByProject[projectId] = project.conversations.sorted { lhs, rhs in
                lhs.isPinned != rhs.isPinned ? lhs.isPinned : lhs.activityDate > rhs.activityDate
            }
        } catch is CancellationError {
            return
        } catch {
            self.error = "Conversations could not be loaded: \(error.localizedDescription)"
        }
    }

    func reset() {
        workspaces = []
        projects = []
        conversationsByProject = [:]
        isUnavailable = false
        error = nil
    }

    private func loadProjects() async throws {
        guard let selectedWorkspaceId else {
            projects = []
            return
        }
        projects = try await apiClient.fetchWorkspace(id: selectedWorkspaceId).projects
    }
}
