import SwiftUI

struct ToolApprovalCard: View {
    @EnvironmentObject private var conversationManager: ConversationManager
    let request: ToolApprovalRequest
    let isPending: Bool

    private var decision: ToolApprovalDecision? {
        conversationManager.approvalDecisions[request.interactionId]
    }

    private var statusText: String? {
        if !isPending || request.isResolved {
            switch request.resolution {
            case "approved": return "Approved"
            case "rejected": return "Rejected"
            default: return "Answered"
            }
        }

        guard let decision else { return nil }

        let waiting = conversationManager.pendingApprovals.filter {
            conversationManager.approvalDecisions[$0.interactionId] == nil
        }.count
        if conversationManager.isSubmittingApprovals {
            return "You chose \(decision.option). Sending…"
        }
        return waiting > 0
            ? "You chose \(decision.option). Waiting on \(waiting) more."
            : "You chose \(decision.option)."
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "exclamationmark.shield")
                    .foregroundStyle(Color.polychat.attention)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Approval required")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.polychat.text)
                    if let message = request.message {
                        Text(message)
                            .font(.subheadline)
                            .foregroundStyle(Color.polychat.text)
                    }
                }
            }

            if let statusText {
                Text(statusText)
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(Color.polychat.textMuted)
            } else {
                HStack(spacing: 8) {
                    ForEach(Array(request.options.enumerated()), id: \.offset) { index, option in
                        Button(option) {
                            Task { await conversationManager.decideApproval(request, option: option) }
                        }
                        .font(.footnote.weight(.semibold))
                        .buttonStyle(.bordered)
                        .tint(index == 0 ? Color.polychat.primary : Color.polychat.textMuted)
                    }
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.polychat.attention.opacity(0.1), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.polychat.attention.opacity(0.4), lineWidth: 1)
        )
    }
}

struct ToolApprovalBatchBar: View {
    @EnvironmentObject private var conversationManager: ConversationManager

    var body: some View {
        let pending = conversationManager.pendingApprovals
        let decided = pending.filter { conversationManager.approvalDecisions[$0.interactionId] != nil }.count
        let remaining = pending.count - decided

        if pending.count > 1 {
            HStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(conversationManager.isSubmittingApprovals
                         ? "Sending \(pending.count) decisions"
                         : "\(decided) of \(pending.count) approvals decided")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Color.polychat.text)
                    Text("They go back together once each one is decided.")
                        .font(.caption2)
                        .foregroundStyle(Color.polychat.textMuted)
                }
                Spacer(minLength: 4)
                if remaining > 0 && !conversationManager.isSubmittingApprovals {
                    Button("Reject \(remaining)") {
                        Task { await conversationManager.decideRemainingApprovals(approve: false) }
                    }
                    .font(.caption.weight(.semibold))
                    .buttonStyle(.bordered)
                    Button("Approve \(remaining)") {
                        Task { await conversationManager.decideRemainingApprovals(approve: true) }
                    }
                    .font(.caption.weight(.semibold))
                    .buttonStyle(.borderedProminent)
                    .tint(Color.polychat.primary)
                } else if conversationManager.isSubmittingApprovals {
                    ProgressView().controlSize(.small)
                }
            }
            .padding(10)
            .background(Color.polychat.attention.opacity(0.12), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .padding(.horizontal, 12)
        }
    }
}
