import SwiftUI

struct WorkDecisionRow: View {
    let item: WorkInboxItem
    let isBusy: Bool
    let onApproveHire: () -> Void
    let onRejectHire: () -> Void
    let onApproveSetup: () -> Void
    let onAnswerStandup: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: icon)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(tint)
                    .frame(width: 30, height: 30)
                    .background(tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 8, style: .continuous))

                VStack(alignment: .leading, spacing: 4) {
                    Text(item.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.polychat.text)
                        .lineLimit(2)
                    if let detail = item.detail, !detail.isEmpty {
                        Text(detail)
                            .font(.footnote)
                            .foregroundStyle(Color.polychat.textMuted)
                            .lineLimit(3)
                    }
                    HStack(spacing: 6) {
                        StatusPill(label: label, tint: tint)
                        Text(RelativeTime.label(for: item.since))
                            .font(.caption)
                            .foregroundStyle(Color.polychat.textMuted)
                    }
                }
            }

            switch item.kind {
            case "hire":
                HStack(spacing: 8) {
                    Button("Approve hire", action: onApproveHire)
                        .buttonStyle(.borderedProminent)
                    Button("Reject", role: .destructive, action: onRejectHire)
                        .buttonStyle(.bordered)
                }
                .controlSize(.small)
                .disabled(isBusy)
                .padding(.leading, 42)
            case "setup":
                Button("Approve and start", action: onApproveSetup)
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                    .disabled(isBusy)
                    .padding(.leading, 42)
            case "standup":
                Button("Answer standup", action: onAnswerStandup)
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                    .disabled(isBusy)
                    .padding(.leading, 42)
            default:
                EmptyView()
            }
        }
        .padding(.vertical, 4)
    }

    private var icon: String {
        switch item.kind {
        case "hire": return "person.badge.plus"
        case "setup": return "list.bullet.rectangle"
        case "standup": return "person.3"
        case "escalation": return "flag"
        case "budget", "paused": return "creditcard"
        default: return "bell"
        }
    }

    private var tint: Color {
        switch item.kind {
        case "escalation", "paused": return Color.polychat.error
        case "budget": return Color.polychat.attention
        default: return Color.polychat.activeWork
        }
    }

    private var label: String {
        switch item.kind {
        case "hire": return "Hire"
        case "setup": return "Setup plan"
        case "standup": return "Standup"
        case "escalation": return "Escalation"
        case "budget": return "Budget"
        case "paused": return "Paused"
        default: return "Inbox"
        }
    }
}

struct StandupAnswerSheet: View {
    let item: WorkInboxItem
    @State var answers: StandupAnswers
    let onSend: (StandupAnswers) async -> Bool
    @Environment(\.dismiss) private var dismiss
    @State private var isSending = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Drafted from your task activity. Edit before sending.")
                        .font(.footnote)
                        .foregroundStyle(Color.polychat.textMuted)
                }
                ForEach($answers.answers, id: \.question) { $answer in
                    Section(answer.question) {
                        TextField("Your answer", text: $answer.answer, axis: .vertical)
                            .lineLimit(2...6)
                    }
                }
            }
            .navigationTitle(item.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Send") {
                        isSending = true
                        Task {
                            let sent = await onSend(answers)
                            isSending = false
                            if sent { dismiss() }
                        }
                    }
                    .disabled(isSending)
                }
            }
        }
    }
}
