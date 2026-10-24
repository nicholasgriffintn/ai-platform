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

            if workStore.workspaces.count > 1 {
                Section {
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
                        HStack {
                            Image(systemName: "building.2")
                                .foregroundStyle(Color.polychat.primary)
                            Text(workStore.selectedWorkspace?.name ?? "Choose a workspace")
                                .foregroundStyle(Color.polychat.text)
                            Spacer()
                            Image(systemName: "chevron.up.chevron.down")
                                .font(.caption)
                                .foregroundStyle(Color.polychat.textMuted)
                        }
                    }
                    .listRowBackground(Color.polychat.surface)
                }
            }

            if !workStore.projects.isEmpty {
                Section(workStore.workspaces.count > 1 ? "Projects" : workStore.selectedWorkspace?.name ?? "Projects") {
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
                                      ? "Shared projects and their conversations appear here once you're on a Work plan."
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
            if let count = project.conversationCount, count > 0 {
                Text("\(count)")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Color.polychat.textMuted)
            }
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.polychat.textMuted)
        }
        .padding(.vertical, 2)
        .contentShape(Rectangle())
    }
}

struct ProjectConversationsView: View {
    @EnvironmentObject private var workStore: WorkStore
    @EnvironmentObject private var conversationManager: ConversationManager
    let projectId: String
    @Binding var path: [ChatsRoute]

    private var project: ProjectSummary? {
        workStore.projects.first { $0.id == projectId }
    }

    private var conversations: [ProjectConversation]? {
        workStore.conversationsByProject[projectId]
    }

    var body: some View {
        List {
            if let error = workStore.error {
                InlineErrorBanner(message: error) {
                    Task { await workStore.loadConversations(projectId: projectId) }
                }
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            }

            if let conversations {
                if conversations.isEmpty {
                    ContentUnavailableView(
                        "No conversations yet",
                        systemImage: "bubble.left.and.bubble.right",
                        description: Text("Start one and everyone in the project can follow along.")
                    )
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                } else {
                    ForEach(conversations) { item in
                        Button {
                            open(item)
                        } label: {
                            HStack {
                                ConversationRow(
                                    conversation: item.conversation(projectId: projectId),
                                    isStreaming: conversationManager.isStreaming(item.id)
                                )
                                if let creator = item.createdBy.name {
                                    Text(creator)
                                        .font(.caption2)
                                        .foregroundStyle(Color.polychat.textMuted)
                                }
                            }
                        }
                        .listRowBackground(Color.polychat.surface)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Color.polychat.background)
        .navigationTitle(project?.name ?? "Project")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    let conversation = conversationManager.startNewConversation(projectId: projectId)
                    path.append(.conversation(conversation.id))
                } label: {
                    Image(systemName: "square.and.pencil")
                }
                .accessibilityLabel("New project conversation")
            }
        }
        .overlay {
            if conversations == nil {
                ProgressView()
            }
        }
        .refreshable { await workStore.loadConversations(projectId: projectId) }
        .task { await workStore.loadConversations(projectId: projectId) }
    }

    private func open(_ item: ProjectConversation) {
        Task {
            await conversationManager.loadConversationMessages(item.conversation(projectId: projectId))
        }
        path.append(.conversation(item.id))
    }
}
