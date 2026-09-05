import SwiftUI

struct ConnectorApprovalCard: View {
    let control: ConnectorApprovalControl
    let onResolve: (String) -> Void
    let onContinue: () -> Void
    let onRefresh: () -> Void

    @State private var lastResolution: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Connector approval", systemImage: "checkmark.shield")
                .font(.headline)
                .foregroundStyle(.orange)

            Text("\(control.approval.provider) wants to run \(control.approval.operation).")
                .font(.subheadline)

            content
        }
        .padding(16)
        .background(Color.polychat.elevatedBackground)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color.polychat.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Exact connector operation approval")
    }

    @ViewBuilder
    private var content: some View {
        switch control.submission {
        case .submitting:
            Label("Sending decision…", systemImage: "hourglass")
                .font(.subheadline)
        case .failed(let message, let retryable):
            status("Could not submit", detail: message, colour: .red)
            if retryable {
                Button("Try again") {
                    if let lastResolution {
                        onResolve(lastResolution)
                    } else {
                        onRefresh()
                    }
                }
                .buttonStyle(.borderedProminent)
            }
        case .acknowledged:
            status(
                "Decision received",
                detail: "The server accepted this exact-operation decision.",
                colour: .green
            )
        case .resolvedElsewhere:
            resolvedContent(prefix: "Resolved on another device")
        case .idle:
            if control.approval.state == "pending" {
                HStack(spacing: 10) {
                    Button("Reject", role: .destructive) {
                        lastResolution = "rejected"
                        onResolve("rejected")
                    }
                    .buttonStyle(.bordered)

                    Button("Approve") {
                        lastResolution = "approved"
                        onResolve("approved")
                    }
                    .buttonStyle(.borderedProminent)
                }
                .disabled(!control.acceptsResolution)
            } else {
                resolvedContent(prefix: nil)
            }
        }
    }

    @ViewBuilder
    private func resolvedContent(prefix: String?) -> some View {
        switch control.approval.state {
        case "approved":
            status(
                prefix ?? "Approved",
                detail: "The exact action is approved but has not run yet.",
                colour: .green
            )
            if control.canContinueApprovedOperation {
                Button("Continue approved action", action: onContinue)
                    .buttonStyle(.borderedProminent)
            }
        case "rejected":
            status(prefix ?? "Rejected", detail: "The connector action will not run.", colour: .orange)
        case "consumed":
            status(prefix ?? "Approval used", detail: "The approved action has continued.", colour: .green)
        case "expired":
            status("Approval expired", detail: "This card can no longer authorise the action.", colour: .orange)
        default:
            status(prefix ?? "Approval pending", detail: "Refresh to get the latest state.", colour: .orange)
        }
    }

    private func status(_ title: String, detail: String, colour: Color) -> some View {
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
}
