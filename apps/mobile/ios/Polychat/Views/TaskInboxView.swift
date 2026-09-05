import SwiftUI

struct TaskInboxView: View {
    @EnvironmentObject var notificationManager: TaskNotificationManager
    @EnvironmentObject var apiClient: APIClient
    @EnvironmentObject var conversationManager: ConversationManager
    @Environment(\.dismiss) private var dismiss
    @State private var path: [String] = []

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if notificationManager.isLoading && notificationManager.items.isEmpty {
                    ProgressView("Loading inbox…")
                } else if notificationManager.items.isEmpty {
                    ContentUnavailableView(
                        "Nothing needs attention",
                        systemImage: "tray",
                        description: Text("Decisions, failures and useful completions appear here.")
                    )
                } else {
                    List(notificationManager.items) { item in
                        NavigationLink(value: item.id) {
                            TaskInboxRow(item: item)
                        }
                        .swipeActions(edge: .trailing) {
                            Button("Dismiss", systemImage: "xmark") {
                                Task { await notificationManager.dismiss(item) }
                            }
                            .tint(.gray)
                        }
                        .swipeActions(edge: .leading) {
                            if !item.isRead {
                                Button("Read", systemImage: "checkmark") {
                                    Task { await notificationManager.markRead(item) }
                                }
                                .tint(.blue)
                            }
                        }
                    }
                    .refreshable {
                        await notificationManager.loadInbox()
                    }
                }
            }
            .navigationTitle("Task inbox")
            .navigationDestination(for: String.self) { itemId in
                if let item = notificationManager.items.first(where: { $0.id == itemId }) {
                    TaskInboxDetailView(item: item, onOpenRun: openRun)
                } else {
                    ContentUnavailableView(
                        "Task state changed",
                        systemImage: "arrow.triangle.2.circlepath",
                        description: Text("This notification is no longer current. Refresh the inbox for the latest state.")
                    )
                }
            }
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .task {
                await notificationManager.loadInbox()
                openRequestedItem()
            }
            .onChange(of: notificationManager.requestedInboxItemId) { _, _ in openRequestedItem() }
        }
    }

    private func openRequestedItem() {
        guard let itemId = notificationManager.requestedInboxItemId else {
            return
        }

        path = [itemId]
        notificationManager.requestedInboxItemId = nil
    }

    private func openRun(_ attempt: ProjectTaskStageAttempt) {
        Task {
            await conversationManager.loadConversationMessages(id: attempt.conversationId)
            dismiss()
        }
    }
}

private struct TaskInboxRow: View {
    let item: TaskInboxItem

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon)
                .foregroundStyle(colour)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(label)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text(item.projectName)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    if !item.isRead {
                        Circle()
                            .fill(Color.blue)
                            .frame(width: 7, height: 7)
                    }
                }
                Text(item.objective)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(2)
                if let detail = item.detail {
                    Text(detail)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var label: String {
        switch item.kind {
        case "input": return "Questions"
        case "approval": return "Approval"
        case "review": return "Review"
        case "blocked": return "Problem"
        case "completion": return "Completed"
        default: return "Assigned"
        }
    }

    private var icon: String {
        switch item.kind {
        case "input": return "questionmark.circle"
        case "approval": return "checkmark.shield"
        case "review", "completion": return "checkmark.circle"
        case "blocked": return "exclamationmark.triangle"
        default: return "person.crop.circle.badge.checkmark"
        }
    }

    private var colour: Color {
        item.kind == "completion" ? .green : item.kind == "blocked" ? .red : .orange
    }
}

private struct TaskInboxDetailView: View {
    @EnvironmentObject var notificationManager: TaskNotificationManager
    @EnvironmentObject var apiClient: APIClient
    let item: TaskInboxItem
    let onOpenRun: (ProjectTaskStageAttempt) -> Void
    @State private var detail: ProjectTaskDetailResponse?
    @State private var control: ProjectTaskInteractionControl?
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(item.objective)
                    .font(.title2.weight(.semibold))
                Text(item.projectName)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                if let detail {
                    if !item.requiresAction || detail.task.status == "running" || detail.task.status == "done" {
                        Text("This notification reflects an earlier task state. The current task is \(detail.task.status).")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }

                    if let control {
                        ProjectTaskInteractionCard(
                            control: control,
                            onAnswerQuestions: submitAnswers,
                            onResolveApproval: submitApproval,
                            onRefresh: { Task { await load() } }
                        )
                    }

                    if let plan = detail.plan {
                        ProjectTaskPlanEvidenceView(plan: plan, onOpenRun: onOpenRun)
                    }

                    ProjectTaskActivityTimelineView(timeline: detail.activity)
                } else if let error {
                    ContentUnavailableView(
                        "Task unavailable",
                        systemImage: "exclamationmark.triangle",
                        description: Text(error)
                    )
                } else {
                    ProgressView("Checking current task state…")
                }
            }
            .padding()
        }
        .navigationTitle("Task")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await notificationManager.markRead(item)
            await load()
        }
    }

    private func load() async {
        do {
            let next = try await apiClient.fetchProjectTask(
                projectId: item.projectId,
                taskId: item.taskId
            )
            detail = next
            control = ProjectTaskInteractionControl.reconcile(next, previous: control)
            error = nil
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
                    projectId: item.projectId,
                    taskId: item.taskId,
                    interactionId: control.interaction.interactionId,
                    answers: answers
                )
                await load()
                await notificationManager.loadInbox()
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
                    projectId: item.projectId,
                    taskId: item.taskId,
                    interactionId: control.interaction.interactionId,
                    resolution: resolution
                )
                await load()
                await notificationManager.loadInbox()
            } catch {
                self.control?.submission = .failed(message: error.localizedDescription, retryable: true)
            }
        }
    }
}
