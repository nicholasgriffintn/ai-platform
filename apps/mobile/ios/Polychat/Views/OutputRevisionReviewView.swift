import SwiftUI

struct OutputRevisionReviewView: View {
    let outputId: String
    private let apiClient: any OutputRevisionsAPIClient

    @State private var history: OutputHistoryResponse?
    @State private var selectedRevision: Int?
    @State private var isLoading = false
    @State private var isRestoring = false
    @State private var error: String?

    init(
        outputId: String,
        apiClient: any OutputRevisionsAPIClient = APIClient.shared
    ) {
        self.outputId = outputId
        self.apiClient = apiClient
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && history == nil {
                    ProgressView("Loading revision history…")
                } else if let history {
                    revisionContent(history)
                } else {
                    ContentUnavailableView(
                        "Revision history unavailable",
                        systemImage: "clock.arrow.trianglehead.counterclockwise.rotate.90",
                        description: Text(error ?? "Try again later.")
                    )
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.polychat.background)
            .navigationTitle("Output History")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .task(id: outputId) {
                await loadHistory()
            }
        }
    }

    private func revisionContent(_ history: OutputHistoryResponse) -> some View {
        let selected = history.revisions.first(where: { $0.revision == selectedRevision })
            ?? history.revisions.first

        return ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(history.current.title)
                        .font(.headline)
                    Text(
                        "Current revision \(history.current.revision) · \(history.current.operation)"
                    )
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }

                if let selected {
                    Picker("Compare with", selection: selectedRevisionBinding(default: selected.revision)) {
                        ForEach(history.revisions) { revision in
                            Text("Revision \(revision.revision) · \(revision.operation)")
                                .tag(Optional(revision.revision))
                        }
                    }
                    .pickerStyle(.menu)

                    comparison(current: history.current, selected: selected)
                    restoreControl(history: history, selected: selected)
                } else {
                    Text("No earlier revisions yet.")
                        .foregroundStyle(.secondary)
                }

                if let error {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .accessibilityLabel("Revision error: \(error)")
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
        }
    }

    private func comparison(current: OutputRevision, selected: OutputRevision) -> some View {
        let fields = OutputRevisionPresentation.changedFields(current: current, selected: selected)

        return VStack(alignment: .leading, spacing: 10) {
            Text("Revision \(selected.revision) compared with current")
                .font(.headline)
            Text(fields.isEmpty ? "No content changes" : "Changed: \(fields.joined(separator: ", "))")
                .font(.subheadline)
            GroupBox("Earlier") {
                Text(selected.title)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            GroupBox("Current") {
                Text(current.title)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            Text(OutputRevisionPresentation.provenanceLabel(selected.provenance))
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(
                "\(selected.provenance.sources.count) source references · " +
                "\(selected.provenance.skills.count) skills · " +
                "\(selected.provenance.approvals.count) approvals"
            )
            .font(.caption)
            .foregroundStyle(.secondary)
        }
    }

    private func restoreControl(
        history: OutputHistoryResponse,
        selected: OutputRevision
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Button {
                Task { await restore(selected, current: history.current) }
            } label: {
                Label(
                    isRestoring ? "Restoring…" : "Restore revision \(selected.revision)",
                    systemImage: "arrow.uturn.backward.circle"
                )
            }
            .buttonStyle(.bordered)
            .disabled(!history.restore.supported || isRestoring)

            Text(
                history.restore.supported
                    ? "Restore appends a new local revision. It does not undo external actions."
                    : history.restore.reason ?? "This output is review-only."
            )
            .font(.caption)
            .foregroundStyle(.secondary)
        }
    }

    private func selectedRevisionBinding(default defaultRevision: Int) -> Binding<Int?> {
        Binding(
            get: { selectedRevision ?? defaultRevision },
            set: { selectedRevision = $0 }
        )
    }

    @MainActor
    private func loadHistory(clearError: Bool = true) async {
        isLoading = true
        defer { isLoading = false }

        do {
            let loaded = try await apiClient.fetchOutputHistory(id: outputId)
            history = loaded
            if selectedRevision == nil || !loaded.revisions.contains(where: {
                $0.revision == selectedRevision
            }) {
                selectedRevision = loaded.revisions.first?.revision
            }
            if clearError {
                error = nil
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    @MainActor
    private func restore(_ selected: OutputRevision, current: OutputRevision) async {
        isRestoring = true
        defer { isRestoring = false }

        do {
            _ = try await apiClient.restoreOutputRevision(
                outputId: outputId,
                revision: selected.revision,
                expectedRevision: current.revision
            )
            await loadHistory()
        } catch {
            let restoreError = error.localizedDescription
            await loadHistory(clearError: false)
            self.error = restoreError
        }
    }
}
