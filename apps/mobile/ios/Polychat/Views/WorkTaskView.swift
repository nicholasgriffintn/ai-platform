import SwiftUI

struct WorkTaskView: View {
    @EnvironmentObject private var apiClient: APIClient
    @Environment(\.dismiss) private var dismiss
    @State private var detail: ProjectTaskDetailResponse?
    @State private var control: ProjectTaskInteractionControl?
    @State private var isWorking = false
    @State private var error: String?
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
                            } else if detail.task.status == "review" {
                                reviewView(detail.task)
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

    private func reviewView(_ task: ProjectTaskControlTask) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Ready for review", systemImage: "doc.text.magnifyingglass")
                .font(.headline)
            Text("Review the conversation, then accept the current result when it is ready.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            if let conversationId = task.conversationId {
                Button("Open conversation") {
                    dismiss()
                    onOpenConversation(conversationId)
                }
                .buttonStyle(.bordered)
            }
            Button("Accept result") {
                perform {
                    _ = try await apiClient.acceptProjectTask(projectId: projectId, taskId: taskId)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isWorking)
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
        } catch {
            self.error = error.localizedDescription
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
