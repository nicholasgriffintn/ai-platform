import SwiftUI

struct WatchItemView: View {
    @EnvironmentObject private var store: WatchStore
    @Environment(\.dismiss) private var dismiss
    @State private var interaction: ProjectTaskInteraction?
    @State private var runApproval: SandboxRunInstruction?
    @State private var answer = ""
    @State private var isLoaded = false
    @State private var isWorking = false
    @State private var message: String?
    let item: WorkAttentionItem

    private let apiClient = APIClient.shared

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text(item.title).font(.headline)
                Text(item.projectName).font(.caption2).foregroundStyle(.secondary)
                if let detail = item.detail {
                    Text(detail).font(.footnote)
                }

                if let interaction, interaction.isPending, interaction.type == "approval" {
                    if let toolName = interaction.toolName {
                        Text(toolName).font(.footnote.weight(.semibold)).padding(.top, 4)
                    }
                    if let reason = interaction.reason {
                        Text(reason).font(.footnote).foregroundStyle(.secondary)
                    }
                    decisionButtons { approved in
                        _ = try await apiClient.resolveProjectTaskApproval(
                            projectId: item.projectId,
                            taskId: item.resourceId,
                            interactionId: interaction.interactionId,
                            resolution: approved ? "approved" : "rejected"
                        )
                    }
                } else if let interaction, interaction.isPending, let question = interaction.questions?.first,
                          interaction.questions?.count == 1 {
                    Text(question.prompt).font(.footnote.weight(.semibold)).padding(.top, 4)
                    ForEach(question.options) { option in
                        Button(option.label) {
                            submit(answer: option.label, question: question, interaction: interaction)
                        }
                        .disabled(isWorking)
                    }
                    if question.options.isEmpty || question.allowOther {
                        TextField("Answer", text: $answer)
                            .onSubmit {
                                submit(answer: answer, question: question, interaction: interaction)
                            }
                    }
                } else if let runApproval {
                    Text("This run is waiting for approval.").font(.footnote).padding(.top, 4)
                    decisionButtons { approved in
                        _ = try await apiClient.sendSandboxRunInstruction(
                            id: item.resourceId,
                            kind: "approval_response",
                            requestId: runApproval.requestId ?? runApproval.id,
                            approvalStatus: approved ? "approved" : "rejected"
                        )
                    }
                } else if isLoaded {
                    Text("This one needs a bigger screen. Open Polychat on your iPhone.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .padding(.top, 4)
                } else {
                    ProgressView()
                }

                if let message {
                    Text(message).font(.footnote).foregroundStyle(.secondary)
                }
            }
        }
        .task { await load() }
    }

    private func decisionButtons(_ decide: @escaping (Bool) async throws -> Void) -> some View {
        VStack(spacing: 6) {
            Button("Approve") { perform { try await decide(true) } }
                .buttonStyle(.borderedProminent)
            Button("Decline", role: .destructive) { perform { try await decide(false) } }
        }
        .disabled(isWorking)
        .padding(.top, 4)
    }

    private func submit(answer: String, question: UserQuestion, interaction: ProjectTaskInteraction) {
        let text = answer.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        perform {
            _ = try await apiClient.answerProjectTaskQuestions(
                projectId: item.projectId,
                taskId: item.resourceId,
                interactionId: interaction.interactionId,
                answers: [UserQuestionAnswer(questionId: question.id, answer: text)]
            )
        }
    }

    private func perform(_ action: @escaping () async throws -> Void) {
        isWorking = true
        Task {
            do {
                try await action()
                store.removeLocally(item)
                dismiss()
            } catch {
                message = error.localizedDescription
            }
            isWorking = false
        }
    }

    private func load() async {
        do {
            if item.type == "run" {
                let response = try await apiClient.fetchSandboxRunInstructions(id: item.resourceId)
                runApproval = response.instructions.map(\.instruction).first(where: \.canRespond)
            } else {
                interaction = try await apiClient.fetchProjectTask(projectId: item.projectId, taskId: item.resourceId).interaction
            }
        } catch {
            message = error.localizedDescription
        }
        isLoaded = true
    }
}
