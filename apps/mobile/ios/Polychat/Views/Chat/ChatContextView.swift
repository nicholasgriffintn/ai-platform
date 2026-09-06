import SwiftUI

struct ChatContextView: View {
    let context: ChatContextSnapshot?
    let usage: ChatRunUsage?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    usageSection
                    if context != nil {
                        sourcesSection
                        approvalsSection
                        skillsSection
                        summarySection
                        omissionsSection
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
            }
            .background(Color.polychat.background)
            .navigationTitle("Run Context")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
        }
    }

    private var usageSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Usage and settlement", systemImage: "gauge.with.dots.needle.50percent")
                    .font(.headline)
                Spacer()
                Text(context.map { "Step \($0.step)" } ?? "Attempt \(usage?.currentAttempt ?? 1)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let context {
                Text(ChatContextPresentation.usageLabel(context.usage))
                    .font(.subheadline)
                Text(
                    context.provider.map { "\(context.model) via \($0)" }
                        ?? "\(context.model) · provider unavailable"
                )
                .font(.caption)
                .foregroundStyle(.secondary)
                ProgressView(
                    value: Double(context.usage.inputTokens),
                    total: Double(max(context.usage.contextWindow, 1))
                )
                .accessibilityLabel("Context window usage")
                Text("\(context.messages.included) messages included · \(context.messages.omitted) omitted")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let usage {
                Text("Provider measurement: \(usage.measurement)")
                    .font(.subheadline)
                Text(
                    usage.reservation.map {
                        "Reserved estimate: \(ChatRunUsagePresentation.credits($0.creditMicros)) credits · not a charge"
                    } ?? "Reserved estimate: none recorded"
                )
                .font(.caption)
                Text(
                    usage.consumption.creditMicros.map {
                        "Recorded consumption: \(ChatRunUsagePresentation.credits($0)) credits"
                    } ?? "Recorded consumption: unknown"
                )
                .font(.caption)
                Text("Settlement: \(usage.settlement.status)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var approvalsSection: some View {
        let approvals = context?.approvals ?? []

        return contextSection(
            title: "Approval references",
            empty: "No recorded approval references.",
            isEmpty: approvals.isEmpty
        ) {
            ForEach(approvals) { approval in
                Text("\(approval.toolName ?? approval.type) · \(approval.status)")
                    .font(.subheadline)
            }
        }
    }

    private var sourcesSection: some View {
        contextSection(
            title: "Attached sources",
            empty: "No attached sources.",
            isEmpty: context?.sources.isEmpty ?? true
        ) {
            ForEach(context?.sources ?? []) { source in
                HStack(alignment: .firstTextBaseline) {
                    Text(source.name)
                    Spacer()
                    Text(source.status.capitalized)
                        .font(.caption)
                        .foregroundStyle(source.status == "included" ? Color.secondary : Color.orange)
                }
                .accessibilityElement(children: .combine)
            }
        }
    }

    private var skillsSection: some View {
        contextSection(
            title: "Effective skills",
            empty: "No skills were effective.",
            isEmpty: context?.skills.isEmpty ?? true
        ) {
            ForEach(context?.skills ?? []) { skill in
                Text(
                    [skill.name, skill.state, skill.revision.map { "r\($0)" }]
                        .compactMap { $0 }
                        .joined(separator: " · ")
                )
                .font(.subheadline)
            }
        }
    }

    @ViewBuilder
    private var summarySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Active summary")
                .font(.headline)
            if let summary = context?.summary {
                DisclosureGroup(
                    "\(summary.representedMessageCount) of \(summary.candidateMessageCount) candidate messages · \(summary.status)\(summary.fallback ? " · verbatim fallback" : "")"
                ) {
                    Text(summary.text)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 8)
                }
            } else {
                Text("No active summary.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var omissionsSection: some View {
        contextSection(
            title: "Omissions",
            empty: "Nothing was omitted from this model call.",
            isEmpty: context?.omissions.isEmpty ?? true
        ) {
            ForEach(context?.omissions ?? []) { omission in
                VStack(alignment: .leading, spacing: 2) {
                    Text(ChatContextPresentation.omissionLabel(omission))
                        .font(.subheadline)
                    if omission.retrievalPath != nil {
                        Text("Full content remains stored and subject to current access.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func contextSection<Content: View>(
        title: String,
        empty: String,
        isEmpty: Bool,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
            if isEmpty {
                Text(empty)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                content()
            }
        }
    }
}
