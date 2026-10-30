import Foundation

@MainActor
final class WorkStore: ObservableObject {
    private static let workspaceKey = "work.selectedWorkspaceId"

    @Published private(set) var workspaces: [WorkspaceSummary] = []
    @Published private(set) var projects: [ProjectSummary] = []
    @Published private(set) var conversationsByProject: [String: [ProjectConversation]] = [:]
    @Published private(set) var projectNames: [String: String] = [:]
    @Published private(set) var tasksByProject: [String: [ProjectTask]] = [:]
    @Published private(set) var myTasks: [ProjectTask] = []
    @Published private(set) var isLoading = false
    @Published private(set) var isUnavailable = false
    @Published var error: String?
    @Published var selectedWorkspaceId: String? = UserDefaults.standard.string(forKey: WorkStore.workspaceKey) {
        didSet {
            UserDefaults.standard.set(selectedWorkspaceId, forKey: Self.workspaceKey)
        }
    }

    private let apiClient: APIClient
    private var finishedProjects: Set<String> = []

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    var selectedWorkspace: WorkspaceSummary? {
        workspaces.first { $0.id == selectedWorkspaceId }
    }

    func workspaceName(_ id: String) -> String? {
        workspaces.first { $0.id == id }?.name
    }

    func projectName(_ id: String) -> String? {
        projects.first { $0.id == id }?.name ?? projectNames[id]
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

    func loadProject(projectId: String) async {
        async let tasks: Void = loadTasks(projectId: projectId)
        async let conversations: Void = loadConversations(projectId: projectId)
        _ = await (tasks, conversations)
    }

    func loadTasks(projectId: String) async {
        do {
            tasksByProject[projectId] = try await apiClient.fetchProjectTasks(
                projectId: projectId,
                includeDone: finishedProjects.contains(projectId)
            )
        } catch is CancellationError {
            return
        } catch {
            self.error = "Tasks could not be loaded: \(error.localizedDescription)"
        }
    }

    func showsFinished(projectId: String) -> Bool {
        finishedProjects.contains(projectId)
    }

    func setShowsFinished(_ shows: Bool, projectId: String) async {
        if shows {
            finishedProjects.insert(projectId)
        } else {
            finishedProjects.remove(projectId)
        }
        await loadTasks(projectId: projectId)
    }

    func loadMyTasks() async {
        do {
            myTasks = try await apiClient.fetchMyWorkTasks()
        } catch APIClientError.httpStatus(let status, _) where status == 402 || status == 403 {
            myTasks = []
        } catch is CancellationError {
            return
        } catch {
            self.error = "Your tasks could not be loaded: \(error.localizedDescription)"
        }
    }

    func createTask(projectId: String, objective: String) async -> ProjectTask? {
        do {
            let created = try await apiClient.createProjectTask(projectId: projectId, objective: objective).task
            await loadTasks(projectId: projectId)
            return tasksByProject[projectId]?.first { $0.id == created.id }
        } catch {
            self.error = "The task could not be added: \(error.localizedDescription)"
            return nil
        }
    }

    func startTask(_ task: ProjectTask) async {
        do {
            _ = try await apiClient.startProjectTask(projectId: task.projectId, taskId: task.id)
            await loadTasks(projectId: task.projectId)
        } catch {
            self.error = "The task could not be started: \(error.localizedDescription)"
        }
    }

    func loadConversations(projectId: String) async {
        do {
            let project = try await apiClient.fetchProject(id: projectId)
            projectNames[projectId] = project.name
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
        projectNames = [:]
        tasksByProject = [:]
        myTasks = []
        finishedProjects = []
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
