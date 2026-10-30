import SwiftUI

struct ProjectBoardView: View {
    @EnvironmentObject private var workStore: WorkStore
    @EnvironmentObject private var conversationManager: ConversationManager
    @Environment(\.openURL) private var openURL
    @State private var isAddingTask = false
    let projectId: String
    @Binding var path: [WorkRoute]

    private var tasks: [ProjectTask]? {
        workStore.tasksByProject[projectId]
    }

    private var sections: [WorkTaskSection] {
        WorkTaskPresentation.sections(for: tasks ?? [])
    }

    private var conversations: [ProjectConversation] {
        workStore.conversationsByProject[projectId] ?? []
    }

    private var workspaceId: String? {
        workStore.projects.first { $0.id == projectId }?.workspaceId
            ?? tasks?.first?.workspaceId
            ?? workStore.selectedWorkspaceId
    }

    var body: some View {
        List {
            if let error = workStore.error {
                InlineErrorBanner(message: error) {
                    Task { await workStore.loadProject(projectId: projectId) }
                }
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            }

            if let tasks, tasks.isEmpty {
                ContentUnavailableView {
                    Label("Nothing on the board", systemImage: "checklist")
                } description: {
                    Text("Add a task and a teammate picks it up, or start it yourself.")
                } actions: {
                    Button("New task") { isAddingTask = true }
                        .buttonStyle(.borderedProminent)
                }
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            }

            ForEach(sections) { section in
                Section {
                    ForEach(section.tasks) { task in
                        NavigationLink(value: WorkRoute.task(projectId: projectId, taskId: task.id, interactionId: nil)) {
                            WorkTaskRow(task: task)
                        }
                        .listRowBackground(Color.polychat.surface)
                        .swipeActions(edge: .leading) {
                            if WorkTaskPresentation.canStart(task) {
                                Button {
                                    Task { await workStore.startTask(task) }
                                } label: {
                                    Label("Start", systemImage: "play.fill")
                                }
                                .tint(Color.polychat.activeWork)
                            }
                        }
                    }
                } header: {
                    HStack {
                        Text(section.group.title)
                        Spacer()
                        Text("\(section.tasks.count)")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(Color.polychat.textMuted)
                    }
                }
            }

            Section("Chats") {
                ForEach(conversations.prefix(5)) { item in
                    Button {
                        open(item)
                    } label: {
                        ConversationRow(
                            conversation: item.conversation(projectId: projectId),
                            isStreaming: conversationManager.isStreaming(item.id)
                        )
                    }
                    .listRowBackground(Color.polychat.surface)
                }
                Button {
                    let conversation = conversationManager.startNewConversation(projectId: projectId)
                    path.append(.conversation(conversation.id))
                } label: {
                    Label("New project chat", systemImage: "square.and.pencil")
                        .foregroundStyle(Color.polychat.primary)
                }
                .listRowBackground(Color.polychat.surface)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Color.polychat.background)
        .navigationTitle(workStore.projectName(projectId) ?? "Project")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    isAddingTask = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("New task")
            }
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Toggle(
                        "Show finished",
                        isOn: Binding(
                            get: { workStore.showsFinished(projectId: projectId) },
                            set: { shows in Task { await workStore.setShowsFinished(shows, projectId: projectId) } }
                        )
                    )
                    if let workspaceId {
                        Button {
                            openURL(WebLinks.project(workspaceId: workspaceId, projectId: projectId))
                        } label: {
                            Label("Open on the web", systemImage: "safari")
                        }
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
                .accessibilityLabel("Project options")
            }
        }
        .sheet(isPresented: $isAddingTask) {
            NewTaskSheet(projectId: projectId) { task in
                path.append(.task(projectId: projectId, taskId: task.id, interactionId: nil))
            }
            .presentationDetents([.medium])
        }
        .overlay {
            if tasks == nil {
                ProgressView()
            }
        }
        .refreshable { await workStore.loadProject(projectId: projectId) }
        .task { await workStore.loadProject(projectId: projectId) }
    }

    private func open(_ item: ProjectConversation) {
        Task {
            await conversationManager.loadConversationMessages(item.conversation(projectId: projectId))
        }
        path.append(.conversation(item.id))
    }
}
