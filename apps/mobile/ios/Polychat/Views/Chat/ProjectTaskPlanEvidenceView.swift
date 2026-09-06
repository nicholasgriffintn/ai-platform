import SwiftUI

struct ProjectTaskPlanEvidenceView: View {
    let plan: ProjectTaskPlanEvidence
    let onOpenRun: (ProjectTaskStageAttempt) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Plan evidence")
                .font(.headline)
            Text("A stage is complete only when an exact run left a durable result.")
                .font(.caption)
                .foregroundStyle(.secondary)

            ForEach(plan.stages) { stage in
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(stage.name)
                            .font(.subheadline.weight(.semibold))
                        Spacer()
                        Text(stage.status.capitalized)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(stage.status == "completed" ? Color.green : Color.secondary)
                    }

                    if stage.attempts.isEmpty {
                        Text("Proposed · no execution evidence")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(stage.attempts) { attempt in
                            VStack(alignment: .leading, spacing: 3) {
                                Text("Run \(attempt.runId.prefix(8)) · attempt \(attempt.attempt) · \(attempt.status)")
                                    .font(.caption)
                                Button("Open run") {
                                    onOpenRun(attempt)
                                }
                                .font(.caption)
                                Text(OutputRevisionPresentation.provenanceLabel(attempt.provenance))
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                if let usage = attempt.usage {
                                    Text(ChatRunUsagePresentation.summary(usage))
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                ForEach(attempt.outputs) { output in
                                    if let destination = URL(string: "polychat://outputs/\(output.id)") {
                                        Link(output.title, destination: destination)
                                            .font(.caption)
                                    }
                                }
                                if let terminalReason = attempt.terminalReason {
                                    Text(terminalReason)
                                        .font(.caption2)
                                        .foregroundStyle(.red)
                                }
                            }
                        }
                    }
                }
                .padding(10)
                .background(Color.polychat.elevatedBackground)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(Color.polychat.border, lineWidth: 1)
                )
            }

            if !plan.resume.supported, let reason = plan.resume.reason {
                Text(reason)
                    .font(.caption)
                    .foregroundStyle(.orange)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Plan stage evidence")
    }
}
