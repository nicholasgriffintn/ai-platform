import SwiftUI

struct WorkTaskView: View {
    @EnvironmentObject private var apiClient: APIClient
    @EnvironmentObject private var workStore: WorkStore
    @Environment(\.openURL) private var openURL
    @State private var detail: ProjectTaskDetailResponse?
    @State private var control: ProjectTaskInteractionControl?
    @State private var isWorking = false
    @State private var error: String?
    let projectId: String
    let taskId: String
    let focusedInteractionId: String?
    let onOpenConversation: (String) -> Void

    var body: some View {
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
        .background(Color.polychat.background)
        .navigationTitle(workStore.projectName(projectId) ?? "Task")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    if let task = detail?.task, let conversationId = task.conversationId {
                        Button {
                            onOpenConversation(conversationId)
                        } label: {
                            Label("Open conversation", systemImage: "bubble.left")
                        }
                    }
                    if let task = detail?.task {
                        Button {
                            openURL(WebLinks.task(workspaceId: task.workspaceId, projectId: projectId, taskId: taskId))
                        } label: {
                            Label("Open on the web", systemImage: "safari")
                        }
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
                .accessibilityLabel("Task options")
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

    private var errorBinding: Binding<Bool> {
        Binding(get: { error != nil }, set: { if !$0 { error = nil } })
    }

    private func taskHeader(_ task: ProjectTaskControlTask) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(task.objective)
                .font(.title3.weight(.semibold))
            Text(WorkTaskPresentation.statusLabel(status: task.status, blockedReason: task.blockedReason))
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

    @ViewBuilder
    private func currentState(_ task: ProjectTaskControlTask) -> some View {
        switch task.status {
        case "backlog":
            VStack(alignment: .leading, spacing: 12) {
                Label("Waiting to be picked up", systemImage: "tray")
                    .font(.headline)
                Text("A teammate takes it from the board, or start it now and it runs with your connections.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Button("Start now") {
                    perform {
                        _ = try await apiClient.startProjectTask(projectId: projectId, taskId: taskId)
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(isWorking)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        case "running", "queued":
            VStack(alignment: .leading, spacing: 8) {
                Label(task.status == "running" ? "Running now" : "Queued", systemImage: "bolt.horizontal")
                    .font(.headline)
                Text("Follow along in the conversation, or wait for it to need you.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        case "blocked":
            VStack(alignment: .leading, spacing: 12) {
                Label("Stuck", systemImage: "exclamationmark.triangle")
                    .font(.headline)
                Text("The lead or the runner picks this up from the board. Open the conversation to see what happened, or sort it out on the web.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if let conversationId = task.conversationId {
                    Button("Open conversation") {
                        onOpenConversation(conversationId)
                    }
                    .buttonStyle(.bordered)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        default:
            ContentUnavailableView(
                task.status == "done" ? "Task completed" : "No response needed",
                systemImage: task.status == "done" ? "checkmark.circle" : "clock",
                description: Text("This task is now \(task.status).")
            )
        }
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
