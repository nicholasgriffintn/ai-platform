import SwiftUI

struct WorkTaskView: View {
    @EnvironmentObject private var apiClient: APIClient
    @Environment(\.dismiss) private var dismiss
    @State private var detail: ProjectTaskDetailResponse?
    @State private var control: ProjectTaskInteractionControl?
    @State private var isWorking = false
    @State private var error: String?
    @StateObject private var flowHistory = ProjectFlowHistoryControl()
    let projectId: String
    let taskId: String
    let focusedInteractionId: String?
    let onOpenConversation: (String) -> Void

    var body: some View {
        NavigationStack {
            Group {
                if let detail {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 18) {
                            taskHeader(detail.task)

                            if let control {
                                ProjectTaskInteractionCard(
                                    control: control,
                                    onAnswerQuestions: submitAnswers,
                                    onResolveApproval: submitApproval,
                                    onRefresh: { Task { await load() } }
                                )
                            } else if let wait = detail.flowWait,
                                      wait.kind == "human", wait.status == "pending",
                                      let node = detail.task.flowSnapshot.nodes.first(where: { $0.id == wait.nodeId }),
                                      node.type == "human_wait" {
                                ProjectFlowReviewView(
                                    node: node,
                                    wait: wait,
                                    canRespond: detail.canRespondToFlowWait,
                                    isWorking: isWorking,
                                    conversationId: detail.task.conversationId,
                                    onOpenConversation: { id in dismiss(); onOpenConversation(id) },
                                    onRespond: submitFlowResponse
                                )
                                .id("\(wait.id):\(wait.revision)")
                            } else {
                                currentState(detail.task)
                            }

                            if let plan = detail.plan {
                                ProjectTaskPlanEvidenceView(
                                    plan: plan,
                                    onOpenRun: { attempt in
                                        dismiss()
                                        onOpenConversation(attempt.conversationId)
                                    }
                                )
                            }

                            ProjectTaskActivityTimelineView(timeline: detail.activity)
                            ProjectFlowHistoryView(
                                flow: detail.task.flowSnapshot,
                                history: flowHistory.history,
                                error: flowHistory.error,
                                isLoading: flowHistory.isLoading,
                                onLoadMore: {
                                    Task { await flowHistory.load(apiClient: apiClient, projectId: projectId, taskId: taskId, reset: false) }
                                }
                            )
                        }
                        .padding()
                    }
                    .refreshable { await load() }
                } else {
                    ProgressView("Loading task…")
                }
            }
            .navigationTitle("Task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .task { await load() }
            .alert("Task changed", isPresented: errorBinding) {
                Button("Reload") { Task { await load() } }
                Button("Close", role: .cancel) {}
            } message: {
                Text(error ?? "Reload the current task and try again.")
            }
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(get: { error != nil }, set: { if !$0 { error = nil } })
    }

    private func taskHeader(_ task: ProjectTaskControlTask) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(task.objective)
                .font(.title3.weight(.semibold))
            Text(task.status.capitalized)
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.polychat.primary.opacity(0.12), in: Capsule())
            if let detail = task.blockedDetail, !detail.isEmpty {
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func currentState(_ task: ProjectTaskControlTask) -> some View {
        ContentUnavailableView(
            task.status == "done" ? "Task completed" : "No response needed",
            systemImage: task.status == "done" ? "checkmark.circle" : "clock",
            description: Text("This task is now \(task.status).")
        )
    }

    private func load() async {
        do {
            let loaded = try await apiClient.fetchProjectTask(projectId: projectId, taskId: taskId)
            detail = loaded
            control = ProjectTaskInteractionControl.reconcile(loaded, previous: control)

            if let focusedInteractionId,
               focusedInteractionId != loaded.interaction?.interactionId {
                error = "That interaction is no longer pending. The current task state is shown."
            } else {
                error = nil
            }
            await flowHistory.load(apiClient: apiClient, projectId: projectId, taskId: taskId, reset: true)
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func submitFlowResponse(_ wait: ProjectFlowWait, _ input: ResolveProjectFlowWaitRequest) {
        guard !isWorking else { return }
        perform {
            _ = try await apiClient.resolveProjectFlowWait(projectId: projectId, taskId: taskId, waitId: wait.id, input: input)
        }
    }

    private func submitAnswers(_ answers: [UserQuestionAnswer]) {
        guard let control else { return }
        self.control?.submission = .submitting

        Task {
            do {
                _ = try await apiClient.answerProjectTaskQuestions(
                    projectId: projectId,
                    taskId: taskId,
                    interactionId: control.interaction.interactionId,
                    answers: answers
                )
                await load()
            } catch {
                self.control?.submission = .failed(message: error.localizedDescription, retryable: true)
            }
        }
    }

    private func submitApproval(_ resolution: String) {
        guard let control else { return }
        self.control?.submission = .submitting

        Task {
            do {
                _ = try await apiClient.resolveProjectTaskApproval(
                    projectId: projectId,
                    taskId: taskId,
                    interactionId: control.interaction.interactionId,
                    resolution: resolution
                )
                await load()
            } catch {
                self.control?.submission = .failed(message: error.localizedDescription, retryable: true)
            }
        }
    }

    private func perform(_ action: @escaping () async throws -> Void) {
        isWorking = true
        Task {
            do {
                try await action()
                await load()
            } catch {
                let message = error.localizedDescription
                await load()
                self.error = message
            }
            isWorking = false
        }
    }
}
