import SwiftUI

struct WorkView: View {
    @EnvironmentObject private var workStore: WorkStore
    @Binding var path: [WorkRoute]

    var body: some View {
        NavigationStack(path: $path) {
            WorkProjectsList(onOpenProject: { path.append(.project($0.id)) })
                .background(Color.polychat.background)
                .navigationTitle("Work")
                .toolbar {
                    if workStore.workspaces.count > 1 {
                        ToolbarItem(placement: .topBarTrailing) {
                            workspaceMenu
                        }
                    }
                }
                .workDestinations(path: $path)
        }
    }

    private var workspaceMenu: some View {
        Menu {
            ForEach(workStore.workspaces) { workspace in
                Button {
                    Task { await workStore.select(workspace.id) }
                } label: {
                    if workspace.id == workStore.selectedWorkspaceId {
                        Label(workspace.name, systemImage: "checkmark")
                    } else {
                        Text(workspace.name)
                    }
                }
            }
        } label: {
            Label(workStore.selectedWorkspace?.name ?? "Workspace", systemImage: "building.2")
                .labelStyle(.titleAndIcon)
                .font(.subheadline)
        }
        .accessibilityLabel("Choose a workspace")
    }
}
