import Foundation

enum ModelQueueLoader {
    static func load(apiClient: APIClient) async throws -> [ModelWorkspaceQueue] {
        let workspaces = try await apiClient.fetchWorkspaces()

        return try await withThrowingTaskGroup(of: ModelWorkspaceQueue.self) { group in
            for workspace in workspaces {
                group.addTask {
                    try await queue(for: workspace, apiClient: apiClient)
                }
            }

            var queues: [ModelWorkspaceQueue] = []

            for try await queue in group where !queue.isEmpty {
                queues.append(queue)
            }

            return queues.sorted { $0.workspace.name < $1.workspace.name }
        }
    }

    private static func queue(for workspace: WorkspaceSummary, apiClient: APIClient) async throws -> ModelWorkspaceQueue {
        let permissions = try await apiClient.fetchMyModelPermissions(workspaceId: workspace.id)
        async let decisions = permissions.can("approve")
            ? apiClient.fetchPendingModelDecisions(workspaceId: workspace.id)
            : []
        async let spend = permissions.can("approve")
            ? apiClient.fetchSpendRequests(workspaceId: workspace.id)
            : []
        async let deployments = permissions.can("deploy")
            ? apiClient.fetchModelDeployments(workspaceId: workspace.id)
            : []

        return try await ModelWorkspaceQueue(
            workspace: workspace,
            permissions: permissions,
            decisions: decisions,
            spendRequests: spend.filter { $0.state == "pending" },
            deployments: deployments.filter { $0.canPause || $0.canResume }
        )
    }
}
