import SwiftUI

struct WorkTaskView: View {
    @EnvironmentObject private var apiClient: APIClient
    @Environment(\.dismiss) private var dismiss
    @State private var detail: MobileProjectTaskDetail?
    @State private var answers: [String: String] = [:]
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

                            if let questions = detail.pendingQuestions {
                                questionsView(questions)
                            } else if let approval = detail.pendingApproval {
                                approvalView(approval)
                            } else if detail.task.status == "review" {
                                reviewView(detail.task)
                            } else {
                                currentState(detail.task)
                            }
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

    private func taskHeader(_ task: MobileProjectTask) -> some View {
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

    private func questionsView(_ questions: MobileUserQuestionSet) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Label("Input required", systemImage: "questionmark.bubble")
                .font(.headline)

            ForEach(questions.questions) { question in
                VStack(alignment: .leading, spacing: 8) {
                    Text(question.prompt)
                        .font(.subheadline.weight(.medium))
                    if !question.options.isEmpty {
                        ForEach(question.options) { option in
                            Button {
                                answers[question.id] = option.label
                            } label: {
                                HStack {
                                    Image(systemName: answers[question.id] == option.label
                                          ? "checkmark.circle.fill"
                                          : "circle")
                                    VStack(alignment: .leading) {
                                        Text(option.label)
                                        if let description = option.description {
                                            Text(description)
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        }
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    if question.allowOther || question.options.isEmpty {
                        TextField(
                            "Your answer",
                            text: answerBinding(for: question.id),
                            axis: .vertical
                        )
                        .textFieldStyle(.roundedBorder)
                    }
                }
            }

            Button("Send answers") {
                answer(questions)
            }
            .buttonStyle(.borderedProminent)
            .disabled(!hasAllAnswers(questions) || isWorking)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func approvalView(_ approval: MobileProjectTaskApproval) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Approval required", systemImage: "checkmark.shield")
                .font(.headline)
            Text(approval.toolName)
                .font(.subheadline.weight(.semibold))
            Text(approval.reason)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            HStack {
                Button("Reject", role: .destructive) {
                    resolve(approval, resolution: "rejected")
                }
                .buttonStyle(.bordered)
                Button("Approve") {
                    resolve(approval, resolution: "approved")
                }
                .buttonStyle(.borderedProminent)
            }
            .disabled(isWorking)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func reviewView(_ task: MobileProjectTask) -> some View {
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

    private func currentState(_ task: MobileProjectTask) -> some View {
        ContentUnavailableView(
            task.status == "done" ? "Task completed" : "No response needed",
            systemImage: task.status == "done" ? "checkmark.circle" : "clock",
            description: Text("This task is now \(task.status).")
        )
    }

    private func answerBinding(for questionId: String) -> Binding<String> {
        Binding(
            get: { answers[questionId] ?? "" },
            set: { answers[questionId] = $0 }
        )
    }

    private func hasAllAnswers(_ questions: MobileUserQuestionSet) -> Bool {
        questions.questions.allSatisfy {
            !(answers[$0.id] ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
    }

    private func answer(_ questions: MobileUserQuestionSet) {
        let submitted = questions.questions.compactMap { question -> MobileUserQuestionAnswer? in
            let answer = (answers[question.id] ?? "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            return answer.isEmpty ? nil : MobileUserQuestionAnswer(questionId: question.id, answer: answer)
        }

        perform {
            _ = try await apiClient.answerProjectTaskQuestions(
                projectId: projectId,
                taskId: taskId,
                interactionId: questions.interactionId,
                answers: submitted
            )
        }
    }

    private func resolve(_ approval: MobileProjectTaskApproval, resolution: String) {
        perform {
            _ = try await apiClient.resolveProjectTaskApproval(
                projectId: projectId,
                taskId: taskId,
                interactionId: approval.interactionId,
                resolution: resolution
            )
        }
    }

    private func load() async {
        do {
            let loaded = try await apiClient.fetchProjectTask(projectId: projectId, taskId: taskId)
            detail = loaded
            answers = Dictionary(
                uniqueKeysWithValues: (loaded.pendingQuestions?.questions ?? []).map {
                    ($0.id, answers[$0.id] ?? "")
                }
            )
            if let focusedInteractionId,
               focusedInteractionId != loaded.pendingQuestions?.interactionId,
               focusedInteractionId != loaded.pendingApproval?.interactionId {
                error = "That interaction is no longer pending. The current task state is shown."
            } else {
                error = nil
            }
        } catch {
            self.error = error.localizedDescription
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
