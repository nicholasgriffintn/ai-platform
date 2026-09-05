import SwiftUI

struct WorkView: View {
    @EnvironmentObject private var apiClient: APIClient
    @Environment(\.dismiss) private var dismiss
    @State private var items: [WorkAttentionItem] = []
    @State private var selectedTarget: MobileWorkTarget?
    @State private var isLoading = true
    @State private var error: String?
    let onOpenConversation: (String) -> Void

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && items.isEmpty {
                    ProgressView("Loading work…")
                } else if items.isEmpty {
                    ContentUnavailableView(
                        "Nothing needs you",
                        systemImage: "checkmark.circle",
                        description: Text("Approvals, questions and finished runs appear here.")
                    )
                } else {
                    List(items) { item in
                        Button {
                            open(item)
                        } label: {
                            WorkAttentionRow(item: item)
                        }
                        .buttonStyle(.plain)
                    }
                    .refreshable { await load() }
                }
            }
            .navigationTitle("Work")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .task { await load() }
            .alert("Couldn’t load work", isPresented: errorBinding) {
                Button("Try again") { Task { await load() } }
                Button("Close", role: .cancel) {}
            } message: {
                Text(error ?? "Try again.")
            }
            .sheet(item: $selectedTarget) { target in
                if let runId = target.runId {
                    WorkRunView(runId: runId)
                        .environmentObject(apiClient)
                } else if let taskId = target.taskId {
                    WorkTaskView(
                        projectId: target.projectId,
                        taskId: taskId,
                        focusedInteractionId: target.interactionId,
                        onOpenConversation: onOpenConversation
                    )
                    .environmentObject(apiClient)
                }
            }
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(
            get: { error != nil },
            set: { if !$0 { error = nil } }
        )
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }

        do {
            items = try await apiClient.fetchWorkAttention().items
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func open(_ item: WorkAttentionItem) {
        if item.type == "run" {
            selectedTarget = MobileWorkTarget(
                workspaceId: item.workspaceId,
                projectId: item.projectId,
                conversationId: item.conversationId,
                taskId: nil,
                runId: item.resourceId,
                interactionId: nil
            )
        } else {
            selectedTarget = MobileWorkTarget(
                workspaceId: item.workspaceId,
                projectId: item.projectId,
                conversationId: item.conversationId,
                taskId: item.resourceId,
                runId: nil,
                interactionId: nil
            )
        }
    }
}

private struct WorkAttentionRow: View {
    let item: WorkAttentionItem

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(colour)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 4) {
                Text(item.title)
                    .font(.headline)
                    .foregroundStyle(.primary)
                Text("\(item.projectName) · \(label)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if let detail = item.detail, !detail.isEmpty {
                    Text(detail)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }

            Spacer()

            if item.isUnread {
                Circle()
                    .fill(Color.polychat.primary)
                    .frame(width: 8, height: 8)
                    .accessibilityLabel("Unread")
            }
        }
        .padding(.vertical, 6)
    }

    private var icon: String {
        switch item.kind {
        case "approval": "checkmark.shield"
        case "input": "questionmark.bubble"
        case "review": "doc.text.magnifyingglass"
        case "failed": "exclamationmark.triangle"
        case "completed": "checkmark.circle"
        default: "bolt"
        }
    }

    private var colour: Color {
        switch item.kind {
        case "failed": Color.polychat.error
        case "completed": Color.polychat.success
        case "approval", "input": Color.polychat.warning
        default: Color.polychat.primary
        }
    }

    private var label: String {
        switch item.kind {
        case "approval": "Approval"
        case "input": "Needs input"
        case "review": "Ready for review"
        case "failed": "Stopped"
        case "completed": "Completed"
        default: "Running"
        }
    }
}

struct WorkRunView: View {
    @EnvironmentObject private var apiClient: APIClient
    @Environment(\.dismiss) private var dismiss
    @State private var detail: SandboxRunDetail?
    @State private var events: [SandboxRunEventEnvelope] = []
    @State private var instructions: [SandboxRunInstructionEnvelope] = []
    @State private var control: SandboxRunControl?
    @State private var selection = 0
    @State private var instruction = ""
    @State private var isWorking = false
    @State private var error: String?
    let runId: String

    var body: some View {
        NavigationStack {
            Group {
                if let detail {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            WorkRunHeader(run: detail.run)
                            Picker("Run detail", selection: $selection) {
                                Text("Activity").tag(0)
                                Text("Proof").tag(1)
                            }
                            .pickerStyle(.segmented)

                            if selection == 0 {
                                activity
                            } else {
                                WorkRunProofView(manifest: detail.run.manifest)
                            }

                            if !detail.run.isTerminal {
                                controls
                            }
                        }
                        .padding()
                    }
                    .refreshable { await load() }
                } else {
                    ProgressView("Loading run…")
                }
            }
            .navigationTitle("Run")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .task { await load() }
            .alert("Run changed", isPresented: errorBinding) {
                Button("Reload") { Task { await load() } }
                Button("Close", role: .cancel) {}
            } message: {
                Text(error ?? "Reload the current state and try again.")
            }
        }
    }

    private var activity: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(pendingApprovals) { envelope in
                VStack(alignment: .leading, spacing: 10) {
                    Label("Approval required", systemImage: "checkmark.shield")
                        .font(.headline)
                    Text("Review the request in Polychat before allowing it to continue.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    HStack {
                        Button("Reject", role: .destructive) {
                            respond(to: envelope.instruction, status: "rejected")
                        }
                        .buttonStyle(.bordered)
                        Button("Approve") {
                            respond(to: envelope.instruction, status: "approved")
                        }
                        .buttonStyle(.borderedProminent)
                    }
                }
                .padding()
                .background(Color.polychat.elevatedBackground, in: RoundedRectangle(cornerRadius: 12))
            }

            ForEach(events) { envelope in
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: eventIcon(envelope.event.type))
                        .foregroundStyle(.secondary)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(eventTitle(envelope.event))
                            .font(.subheadline.weight(.medium))
                        Text(envelope.recordedAt)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var controls: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Guide this run")
                .font(.headline)
            TextField("Add an instruction", text: $instruction, axis: .vertical)
                .textFieldStyle(.roundedBorder)
            HStack {
                Button("Send") { sendInstruction() }
                    .buttonStyle(.borderedProminent)
                    .disabled(instruction.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                Button("Continue") { continueRun() }
                    .buttonStyle(.bordered)
                Spacer()
                Button("Cancel", role: .destructive) { cancelRun() }
                    .buttonStyle(.bordered)
            }
            .disabled(isWorking)
        }
        .padding()
        .background(Color.polychat.elevatedBackground, in: RoundedRectangle(cornerRadius: 12))
    }

    private var pendingApprovals: [SandboxRunInstructionEnvelope] {
        instructions.filter { $0.instruction.canRespond }
    }

    private var errorBinding: Binding<Bool> {
        Binding(get: { error != nil }, set: { if !$0 { error = nil } })
    }

    private func load() async {
        do {
            async let loadedDetail = apiClient.fetchSandboxRun(id: runId)
            async let loadedEvents = apiClient.fetchSandboxRunEvents(id: runId)
            async let loadedInstructions = apiClient.fetchSandboxRunInstructions(id: runId)
            async let loadedControl = apiClient.fetchSandboxRunControl(id: runId)

            detail = try await loadedDetail
            events = try await loadedEvents.events
            instructions = try await loadedInstructions.instructions
            control = try await loadedControl
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func sendInstruction() {
        let content = instruction.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { return }
        instruction = ""
        perform {
            _ = try await apiClient.sendSandboxRunInstruction(
                id: runId,
                kind: "message",
                content: content
            )
        }
    }

    private func continueRun() {
        perform {
            _ = try await apiClient.sendSandboxRunInstruction(id: runId, kind: "continue")
        }
    }

    private func respond(to instruction: SandboxRunInstruction, status: String) {
        perform {
            _ = try await apiClient.sendSandboxRunInstruction(
                id: runId,
                kind: "approval_response",
                requestId: instruction.requestId ?? instruction.id,
                approvalStatus: status
            )
        }
    }

    private func cancelRun() {
        guard let control else { return }
        perform {
            _ = try await apiClient.updateSandboxRunControl(
                id: runId,
                action: "cancel",
                expectedUpdatedAt: control.updatedAt
            )
        }
    }

    private func perform(_ action: @escaping () async throws -> Void) {
        isWorking = true
        Task {
            do {
                try await action()
                await load()
            } catch {
                self.error = error.localizedDescription
                await load()
            }
            isWorking = false
        }
    }

    private func eventTitle(_ event: SandboxRunEvent) -> String {
        switch event.type {
        case "run_started": "Run started"
        case "run_completed": "Run completed"
        case "run_failed": "Run stopped"
        case "run_cancelled": "Run cancelled"
        case "run_paused": "Run paused"
        case "run_resumed": "Run continued"
        case "file_changed": event.path.map { "Changed \($0)" } ?? "File changed"
        case "validation_completed": "Validation completed"
        case "run_instruction_submitted": "Instruction received"
        default: event.type.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    private func eventIcon(_ type: String) -> String {
        if type.contains("failed") { return "exclamationmark.triangle" }
        if type.contains("completed") { return "checkmark.circle" }
        if type.contains("file") { return "doc" }
        return "circle.fill"
    }
}

private struct WorkRunHeader: View {
    let run: SandboxRun

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(run.task)
                .font(.title3.weight(.semibold))
            Text(run.repo)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text(run.status.capitalized)
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.polychat.primary.opacity(0.12), in: Capsule())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct WorkRunProofView: View {
    let manifest: SandboxRunManifest?

    var body: some View {
        if let manifest {
            VStack(alignment: .leading, spacing: 16) {
                proofSection("Outcome") {
                    Text(manifest.outcome.summary ?? manifest.outcome.status.capitalized)
                }
                proofSection("Changes") {
                    Text("\(manifest.changes.fileCount) changed files")
                    ForEach(manifest.changes.files, id: \.self) { file in
                        Label(file, systemImage: "doc")
                            .font(.caption)
                    }
                    if manifest.changes.filesTruncated {
                        Text("More changed files are available on the web.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                proofSection("Validation") {
                    Text(manifest.validation.qualityGate.capitalized)
                    ForEach(manifest.validation.checks) { check in
                        Label(
                            check.command,
                            systemImage: check.status == "passed" ? "checkmark.circle" : "xmark.circle"
                        )
                        .font(.caption)
                    }
                }
                if !manifest.residualRisks.isEmpty {
                    proofSection("Residual risks") {
                        ForEach(manifest.residualRisks, id: \.self) { Text("• \($0)") }
                    }
                }
                if !manifest.incompleteWork.isEmpty {
                    proofSection("Incomplete work") {
                        ForEach(manifest.incompleteWork, id: \.self) { Text("• \($0)") }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            ContentUnavailableView(
                "Proof isn’t available yet",
                systemImage: "doc.text.magnifyingglass"
            )
        }
    }

    private func proofSection<Content: View>(
        _ title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.headline)
            content()
        }
    }
}
