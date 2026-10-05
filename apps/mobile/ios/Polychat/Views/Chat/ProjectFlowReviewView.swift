import SwiftUI

struct ProjectFlowReviewView: View {
    let node: ProjectFlowNode
    let wait: ProjectFlowWait
    let canRespond: Bool
    let isWorking: Bool
    let conversationId: String?
    let onOpenConversation: (String) -> Void
    let onRespond: (ProjectFlowWait, ResolveProjectFlowWaitRequest) -> Void
    @State private var draft = ProjectFlowReviewDraft()
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label(node.name, systemImage: "doc.text.magnifyingglass")
                .font(.headline)
            Text(node.prompt ?? "Review the work before continuing.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            if let conversationId {
                Button("Open conversation") { onOpenConversation(conversationId) }
                    .buttonStyle(.bordered)
            }
            if canRespond {
                ForEach(node.fields ?? []) { field in fieldView(field) }
                if let error { Text(error).font(.caption).foregroundStyle(.red) }
                HStack {
                    Button("Accept and continue") { respond("accepted") }
                        .buttonStyle(.borderedProminent)
                    Button("Reject", role: .destructive) { respond("rejected") }
                        .buttonStyle(.bordered)
                }
                .disabled(isWorking)
            } else {
                Text("Waiting for the assigned reviewer.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func fieldView(_ field: NativeRecordColumn) -> some View {
        if field.type == "boolean" {
            Toggle(field.name, isOn: Binding(get: { draft.checked[field.id] ?? false }, set: { draft.checked[field.id] = $0 }))
                .disabled(isWorking)
        } else {
            VStack(alignment: .leading, spacing: 5) {
                Text(field.required ? "\(field.name) (required)" : field.name)
                    .font(.subheadline)
                if field.type == "select" {
                    Picker(field.name, selection: answerBinding(field.id)) {
                        Text("Choose…").tag("")
                        ForEach(field.options ?? [], id: \.self) { option in Text(option).tag(option) }
                    }
                    .pickerStyle(.menu)
                } else {
                    TextField(field.type == "date" ? "YYYY-MM-DD" : field.name, text: answerBinding(field.id))
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(field.type == "number" ? .numbersAndPunctuation : .default)
                }
            }
            .disabled(isWorking)
        }
    }

    private func answerBinding(_ id: String) -> Binding<String> {
        Binding(get: { draft.answers[id] ?? "" }, set: { draft.answers[id] = $0 })
    }

    private func respond(_ resolution: String) {
        do {
            let values = resolution == "accepted" ? try draft.values(for: node.fields ?? []) : [:]
            error = nil
            onRespond(wait, ResolveProjectFlowWaitRequest(expectedRevision: wait.revision, resolution: resolution, values: values))
        } catch {
            self.error = error.localizedDescription
        }
    }
}
