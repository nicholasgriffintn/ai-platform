import SwiftUI

struct ProjectTaskInteractionCard: View {
    let control: ProjectTaskInteractionControl
    let onAnswerQuestions: ([UserQuestionAnswer]) -> Void
    let onResolveApproval: (String) -> Void
    let onRefresh: () -> Void

    @State private var answers: [String: String] = [:]
    @State private var lastApprovalResolution: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            header

            if !control.interaction.isSupported {
                statusPanel(
                    title: "Unsupported decision",
                    detail: "Update Polychat to respond to this decision type.",
                    colour: .orange
                )
                Button("Refresh task", action: onRefresh)
                    .buttonStyle(.bordered)
            } else {
                interactionContent
            }
        }
        .padding(16)
        .background(Color.polychat.elevatedBackground)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color.polychat.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Task decision")
        .onChange(of: control.interaction.interactionId) {
            answers = Dictionary(
                uniqueKeysWithValues: (control.interaction.answers ?? []).map {
                    ($0.questionId, $0.answer)
                }
            )
            lastApprovalResolution = nil
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: control.interaction.type == "approval" ? "checkmark.shield" : "questionmark.circle")
                .foregroundStyle(.orange)
            VStack(alignment: .leading, spacing: 3) {
                Text(control.interaction.type == "approval" ? "Approval needed" : "The agent needs your input")
                    .font(.headline)
                Text(control.task.objective)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            Spacer()
        }
    }

    @ViewBuilder
    private var interactionContent: some View {
        switch control.interaction.status {
        case "expired":
            statusPanel(
                title: "This decision expired",
                detail: "Refresh the task before continuing. The expired card cannot authorise work.",
                colour: .orange
            )
            Button("Refresh task", action: onRefresh)
                .buttonStyle(.bordered)
        case "interrupted":
            statusPanel(
                title: "The task could not continue",
                detail: control.interaction.detail ?? "The provider stopped before the task could continue.",
                colour: .red
            )
            Button("Refresh task", action: onRefresh)
                .buttonStyle(.bordered)
        case "resolved":
            statusPanel(
                title: resolutionTitle,
                detail: "This card is no longer actionable.",
                colour: .green
            )
        default:
            pendingContent
        }
    }

    @ViewBuilder
    private var pendingContent: some View {
        switch control.submission {
        case .submitting:
            HStack(spacing: 8) {
                ProgressView()
                Text("Sending decision…")
                    .font(.subheadline)
            }
            .accessibilityElement(children: .combine)
        case .acknowledged:
            statusPanel(
                title: "Decision received",
                detail: "The server accepted this response. Waiting for the task to continue.",
                colour: .green
            )
        case .resolvedElsewhere:
            statusPanel(
                title: "Resolved on another device",
                detail: "Refresh shows the authoritative task state.",
                colour: .green
            )
        case .failed(let message, let retryable):
            statusPanel(title: "Could not send", detail: message, colour: .red)
            if retryable {
                Button("Try again", action: retrySubmission)
                    .buttonStyle(.borderedProminent)
                    .accessibilityHint("Resubmits this exact task decision")
            }
        case .idle:
            if control.interaction.type == "question" {
                questionForm
            } else {
                approvalForm
            }
        }
    }

    private var questionForm: some View {
        VStack(alignment: .leading, spacing: 16) {
            ForEach(control.interaction.questions ?? []) { question in
                VStack(alignment: .leading, spacing: 8) {
                    Text(question.prompt)
                        .font(.subheadline.weight(.semibold))

                    ForEach(question.options) { option in
                        Button {
                            answers[question.id] = option.label
                        } label: {
                            HStack(alignment: .top, spacing: 10) {
                                Image(systemName: answers[question.id] == option.label ? "checkmark.circle.fill" : "circle")
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(option.label)
                                    if let description = option.description {
                                        Text(description)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                Spacer()
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(question.prompt): \(option.label)")
                    }

                    if question.allowOther {
                        TextField(
                            question.options.isEmpty ? "Write an answer" : "Other answer",
                            text: answerBinding(for: question.id),
                            axis: .vertical
                        )
                        .textFieldStyle(.roundedBorder)
                        .accessibilityLabel("Answer: \(question.prompt)")
                    }
                }
            }

            Button("Send answers") {
                onAnswerQuestions(questionAnswers)
            }
            .buttonStyle(.borderedProminent)
            .disabled(!hasEveryAnswer || !control.acceptsSubmission)
            .accessibilityHint("Sends all answers for this exact task interaction")
        }
    }

    private var approvalForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(control.interaction.reason ?? "This task needs approval before continuing.")
                .font(.subheadline)

            if let toolName = control.interaction.toolName {
                Text(toolName)
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
            }

            HStack(spacing: 10) {
                Button("Reject", role: .destructive) {
                    lastApprovalResolution = "rejected"
                    onResolveApproval("rejected")
                }
                .buttonStyle(.bordered)

                Button("Approve") {
                    lastApprovalResolution = "approved"
                    onResolveApproval("approved")
                }
                .buttonStyle(.borderedProminent)
            }
            .disabled(!control.acceptsSubmission)
        }
    }

    private func statusPanel(title: String, detail: String, colour: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.subheadline.weight(.semibold))
            Text(detail)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(colour.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    private var resolutionTitle: String {
        switch control.interaction.resolution {
        case "approved":
            return "Approved"
        case "rejected":
            return "Rejected"
        default:
            return "Already resolved"
        }
    }

    private var questionAnswers: [UserQuestionAnswer] {
        (control.interaction.questions ?? []).compactMap { question in
            let answer = answers[question.id]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return answer.isEmpty ? nil : UserQuestionAnswer(questionId: question.id, answer: answer)
        }
    }

    private var hasEveryAnswer: Bool {
        questionAnswers.count == control.interaction.questions?.count
    }

    private func answerBinding(for questionId: String) -> Binding<String> {
        Binding(
            get: { answers[questionId] ?? "" },
            set: { answers[questionId] = $0 }
        )
    }

    private func retrySubmission() {
        if control.interaction.type == "question" {
            guard hasEveryAnswer else {
                return
            }
            onAnswerQuestions(questionAnswers)
        } else if let lastApprovalResolution {
            onResolveApproval(lastApprovalResolution)
        } else {
            onRefresh()
        }
    }
}
