import SwiftUI

struct ModelApprovalsView: View {
    @EnvironmentObject private var apiClient: APIClient
    @Environment(\.dismiss) private var dismiss
    @State private var queues: [ModelWorkspaceQueue] = []
    @State private var isLoading = true
    @State private var busyId: String?
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && queues.isEmpty {
                    ProgressView("Loading models…")
                } else if queues.isEmpty {
                    ContentUnavailableView(
                        "Nothing on the perch",
                        systemImage: "checkmark.seal",
                        description: Text("Model reviews, spend requests and running deployments appear here.")
                    )
                } else {
                    List {
                        ForEach(queues) { queue in
                            workspaceSections(queue)
                        }
                    }
                    .refreshable { await load() }
                }
            }
            .navigationTitle("Models")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .task { await load() }
            .alert("That didn’t work", isPresented: errorBinding) {
                Button("Close", role: .cancel) {}
            } message: {
                Text(error ?? "Try again.")
            }
        }
    }

    @ViewBuilder
    private func workspaceSections(_ queue: ModelWorkspaceQueue) -> some View {
        if !queue.decisions.isEmpty {
            Section("\(queue.workspace.name) · Reviews") {
                ForEach(queue.decisions) { decision in
                    ActionRow(
                        title: decision.displayName,
                        detail: decision.isException ? "Exception requested · \(decision.verdict.effect)" : decision.verdict.effect,
                        isBusy: busyId == decision.id,
                        primary: ("Approve", {
                            await run(decision.id) {
                                try await apiClient.resolveModelDecision(workspaceId: queue.id, decisionId: decision.id, state: "approved")
                            }
                        }),
                        secondary: ("Reject", {
                            await run(decision.id) {
                                try await apiClient.resolveModelDecision(workspaceId: queue.id, decisionId: decision.id, state: "rejected")
                            }
                        })
                    )
                }
            }
        }

        if !queue.spendRequests.isEmpty {
            Section("\(queue.workspace.name) · Spend") {
                ForEach(queue.spendRequests) { request in
                    ActionRow(
                        title: request.summary,
                        detail: request.estimateUsd.map { String(format: "About $%.2f", $0) } ?? request.reason,
                        isBusy: busyId == request.id,
                        primary: ("Approve and start", {
                            await run(request.id) {
                                try await apiClient.resolveSpendRequest(workspaceId: queue.id, requestId: request.id, state: "approved")
                            }
                        }),
                        secondary: ("Reject", {
                            await run(request.id) {
                                try await apiClient.resolveSpendRequest(workspaceId: queue.id, requestId: request.id, state: "rejected")
                            }
                        })
                    )
                }
            }
        }

        if !queue.deployments.isEmpty {
            Section("\(queue.workspace.name) · Deployments") {
                ForEach(queue.deployments) { deployment in
                    ActionRow(
                        title: deployment.name,
                        detail: "\(deployment.displayName) · \(deployment.provider) · \(deployment.status.replacingOccurrences(of: "_", with: " "))",
                        isBusy: busyId == deployment.id,
                        primary: (deployment.canResume ? "Resume" : "Pause", {
                            await run(deployment.id) {
                                try await apiClient.changeModelDeployment(
                                    workspaceId: queue.id,
                                    deploymentId: deployment.id,
                                    action: deployment.canResume ? "resume" : "pause"
                                )
                            }
                        }),
                        secondary: nil
                    )
                }
            }
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(
            get: { error != nil },
            set: { if !$0 { error = nil } }
        )
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }

        do {
            queues = try await ModelQueueLoader.load(apiClient: apiClient)
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func run(_ id: String, _ work: () async throws -> Void) async {
        busyId = id
        defer { busyId = nil }

        do {
            try await work()
            await load()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

private struct ActionRow: View {
    let title: String
    let detail: String?
    let isBusy: Bool
    let primary: (String, () async -> Void)
    let secondary: (String, () async -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
            if let detail, !detail.isEmpty {
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            HStack {
                Button(primary.0) {
                    Task { await primary.1() }
                }
                .buttonStyle(.borderedProminent)
                if let secondary {
                    Button(secondary.0, role: .destructive) {
                        Task { await secondary.1() }
                    }
                    .buttonStyle(.bordered)
                }
                if isBusy {
                    ProgressView()
                }
            }
            .disabled(isBusy)
        }
        .padding(.vertical, 4)
    }
}
