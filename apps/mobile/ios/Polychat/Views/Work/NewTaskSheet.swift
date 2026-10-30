import SwiftUI

struct NewTaskSheet: View {
    @EnvironmentObject private var workStore: WorkStore
    @Environment(\.dismiss) private var dismiss
    @FocusState private var isFocused: Bool
    @State private var objective = ""
    @State private var startNow = false
    @State private var isSaving = false
    let projectId: String
    let onCreated: (ProjectTask) -> Void

    private var trimmed: String {
        objective.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("What needs doing?", text: $objective, axis: .vertical)
                        .lineLimit(3...8)
                        .focused($isFocused)
                } footer: {
                    Text("One clear objective. Teammates pick it up from the board, or start it now to run it straight away.")
                }
                Section {
                    Toggle("Start straight away", isOn: $startNow)
                }
            }
            .navigationTitle("New task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") { save() }
                        .disabled(trimmed.isEmpty || isSaving)
                }
            }
            .onAppear { isFocused = true }
        }
    }

    private func save() {
        isSaving = true
        Task {
            guard let task = await workStore.createTask(projectId: projectId, objective: trimmed) else {
                isSaving = false
                return
            }
            if startNow {
                await workStore.startTask(task)
            }
            isSaving = false
            dismiss()
            onCreated(task)
        }
    }
}
