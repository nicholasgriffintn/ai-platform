import Foundation

struct WorkspaceListResponse: Decodable {
    let workspaces: [WorkspaceSummary]
}

struct WorkspaceSummary: Decodable, Identifiable {
    let id: String
    let name: String
    let role: String
}

struct MyModelPermissions: Decodable {
    let role: String
    let actions: [String]
    let separationOfDuties: Bool

    func can(_ action: String) -> Bool {
        actions.contains(action)
    }
}

struct ModelVerdict: Decodable {
    let effect: String
}

struct ModelDecisionsResponse: Decodable {
    let decisions: [ModelDecisionItem]
}

struct ModelDecisionItem: Decodable, Identifiable {
    let id: String
    let versionId: String
    let routeId: String?
    let state: String
    let verdict: ModelVerdict
    let isException: Bool
    let note: String?
    let displayName: String
    let revision: String
    let createdAt: String
}

struct SpendRequestsResponse: Decodable {
    let requests: [SpendRequestItem]
}

struct SpendRequestItem: Decodable, Identifiable {
    let id: String
    let summary: String
    let estimateUsd: Double?
    let reason: String?
    let state: String
    let createdAt: String
}

struct ModelDeploymentsResponse: Decodable {
    let deployments: [ModelDeploymentItem]
}

struct ModelDeploymentItem: Decodable, Identifiable {
    let id: String
    let name: String
    let displayName: String
    let status: String
    let provider: String
    let hourlyUsd: Double?

    var canPause: Bool {
        status == "running" || status == "scaled_to_zero"
    }

    var canResume: Bool {
        status == "paused"
    }
}

struct ResolveModelDecisionRequest: Encodable {
    let state: String
}

struct ResolveSpendRequestBody: Encodable {
    let state: String
}

struct ModelWorkspaceQueue: Identifiable {
    let workspace: WorkspaceSummary
    let permissions: MyModelPermissions
    let decisions: [ModelDecisionItem]
    let spendRequests: [SpendRequestItem]
    let deployments: [ModelDeploymentItem]

    var id: String { workspace.id }

    var isEmpty: Bool {
        decisions.isEmpty && spendRequests.isEmpty && deployments.isEmpty
    }
}

struct ModelActionResult: Decodable {
    let id: String
}
