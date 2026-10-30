import SwiftUI

struct WorkProjectsList: View {
    @EnvironmentObject private var workStore: WorkStore
    let onOpenProject: (ProjectSummary) -> Void

    var body: some View {
        List {
            if let error = workStore.error {
                InlineErrorBanner(message: error) {
                    Task { await workStore.refresh() }
                }
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            }

            if !workStore.projects.isEmpty {
                Section(workStore.selectedWorkspace?.name ?? "Projects") {
                    ForEach(workStore.projects) { project in
                        Button {
                            onOpenProject(project)
                        } label: {
                            ProjectRow(project: project)
                        }
                        .listRowBackground(Color.polychat.surface)
                    }
                }
            } else if !workStore.isLoading {
                ContentUnavailableView(
                    workStore.isUnavailable ? "Work isn't on your plan" : "No projects yet",
                    systemImage: "briefcase",
                    description: Text(workStore.isUnavailable
                                      ? "Shared projects, their tasks and teammates appear here once you're on a Work plan."
                                      : "Projects you create or join on the web show up here.")
                )
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .refreshable { await workStore.refresh() }
        .task { await workStore.refresh() }
        .overlay {
            if workStore.isLoading && workStore.projects.isEmpty {
                ProgressView()
            }
        }
    }
}

private struct ProjectRow: View {
    let project: ProjectSummary

    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Color(hex: project.colour) ?? Color.polychat.primary)
                .frame(width: 30, height: 30)
                .overlay(
                    Text(String(project.name.prefix(1)).uppercased())
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(.white)
                )
            VStack(alignment: .leading, spacing: 2) {
                Text(project.name)
                    .font(.body.weight(.medium))
                    .foregroundStyle(Color.polychat.text)
                    .lineLimit(1)
                if !project.description.isEmpty {
                    Text(project.description)
                        .font(.caption)
                        .foregroundStyle(Color.polychat.textMuted)
                        .lineLimit(1)
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.polychat.textMuted)
        }
        .padding(.vertical, 2)
        .contentShape(Rectangle())
    }
}
