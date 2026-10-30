import SwiftUI

struct AttentionView: View {
    @EnvironmentObject private var store: AttentionStore
    @EnvironmentObject private var inbox: TaskNotificationManager
    @EnvironmentObject private var workStore: WorkStore
    @Environment(\.openURL) private var openURL
    @Binding var path: [WorkRoute]
    @State private var view: InboxView = .needsYou
    @State private var standupItem: WorkInboxItem?
    @State private var standupAnswers: StandupAnswers?
    @State private var decidingItemId: String?

    private var entries: [AttentionEntry] {
        AttentionPlaces.entries(
            for: view,
            decisions: store.decisions,
            runs: store.runItems,
            notifications: inbox.items
        )
    }

    private var places: [AttentionPlace] {
        AttentionPlaces.group(
            entries,
            workItems: store.runItems,
            notifications: inbox.items,
            workspaceNames: store.workspaceNames.merging(
                Dictionary(workStore.workspaces.map { ($0.id, $0.name) }, uniquingKeysWith: { first, _ in first }),
                uniquingKeysWith: { first, _ in first }
            ),
            projectNames: store.projectNames.merging(workStore.projectNames, uniquingKeysWith: { first, _ in first })
        )
    }

    private var isLoading: Bool {
        store.isLoading || inbox.isLoading
    }

    private var counts: [InboxView: Int] {
        [
            .needsYou: AttentionPlaces.entries(for: .needsYou, decisions: store.decisions, runs: store.runItems, notifications: inbox.items).count,
            .updates: AttentionPlaces.entries(for: .updates, decisions: store.decisions, runs: store.runItems, notifications: inbox.items).count,
            .myTasks: workStore.myTasks.count
        ]
    }

    var body: some View {
        NavigationStack(path: $path) {
            List {
                Section {
                    Picker("Inbox view", selection: $view) {
                        ForEach(InboxView.allCases) { view in
                            Text(title(for: view)).tag(view)
                        }
                    }
                    .pickerStyle(.segmented)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                }

                if let error = store.error ?? inbox.error ?? workStore.error {
                    InlineErrorBanner(message: error) {
                        Task { await refresh() }
                    }
                    .listRowSeparator(.hidden)
                    .listRowBackground(Color.clear)
                }

                switch view {
                case .needsYou, .updates:
                    inboxSections
                case .myTasks:
                    myTaskSections
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Color.polychat.background)
            .navigationTitle("Inbox")
            .sheet(item: $standupItem) { item in
                if let answers = standupAnswers {
                    StandupAnswerSheet(item: item, answers: answers) { sent in
                        let ok = await store.answerStandup(item, answers: sent)
                        await publish()
                        return ok
                    }
                }
            }
            .refreshable { await refresh() }
            .task { await refresh() }
            .overlay {
                if entries.isEmpty && isLoading && view != .myTasks {
                    ProgressView()
                }
            }
            .workDestinations(path: $path)
        }
    }

    private func title(for view: InboxView) -> String {
        guard let count = counts[view], count > 0 else { return view.title }
        return "\(view.title) \(count)"
    }

    @ViewBuilder
    private var inboxSections: some View {
        ForEach(places) { place in
            Section {
                ForEach(place.entries) { entry in
                    row(for: entry)
                }
            } header: {
                sectionHeader(place.title, count: view == .needsYou ? place.needsYouCount : 0)
            }
        }

        if view == .updates && !store.visibleBackgroundTasks.isEmpty {
            Section {
                ForEach(store.visibleBackgroundTasks) { task in
                    BackgroundTaskRow(task: task)
                }
            } header: {
                sectionHeader("Background tasks", count: 0)
            }
        }

        if entries.isEmpty && !isLoading && (view == .needsYou || store.visibleBackgroundTasks.isEmpty) {
            emptyState
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
        }
    }

    @ViewBuilder
    private var emptyState: some View {
        if view == .needsYou {
            ContentUnavailableView {
                Label("Nothing needs you", systemImage: "checkmark.circle")
            } description: {
                Text(store.workUnavailable
                     ? "Approvals, questions and hires land here. Shared project work needs a Work plan."
                     : "Leads handle their team's questions first. Approvals, hires, escalations and anything only you can answer land here.")
            }
        } else {
            ContentUnavailableView {
                Label("No updates", systemImage: "tray")
            } description: {
                Text("Finished work and handovers from your teams show up here.")
            }
        }
    }

    @ViewBuilder
    private var myTaskSections: some View {
        let groups = Dictionary(grouping: workStore.myTasks, by: \.projectId)
        let projectIds = groups.keys.sorted { left, right in
            (groups[left]?.first?.activityDate ?? .distantPast) > (groups[right]?.first?.activityDate ?? .distantPast)
        }

        ForEach(projectIds, id: \.self) { projectId in
            if let tasks = groups[projectId], let first = tasks.first {
                Section {
                    ForEach(tasks.sorted { $0.activityDate > $1.activityDate }) { task in
                        NavigationLink(value: WorkRoute.task(projectId: task.projectId, taskId: task.id, interactionId: nil)) {
                            WorkTaskRow(task: task)
                        }
                        .listRowBackground(Color.polychat.surface)
                    }
                } header: {
                    NavigationLink(value: WorkRoute.project(projectId)) {
                        sectionHeader(myTasksTitle(workspaceId: first.workspaceId, projectId: projectId), count: 0)
                    }
                }
            }
        }

        if workStore.myTasks.isEmpty && !workStore.isLoading {
            ContentUnavailableView {
                Label("Nothing on your plate", systemImage: "checklist")
            } description: {
                Text("Tasks you own, and tasks teammates run on your behalf, show up here.")
            }
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
        }
    }

    private func myTasksTitle(workspaceId: String, projectId: String) -> String {
        let workspace = store.workspaceNames[workspaceId] ?? workStore.workspaceName(workspaceId) ?? "Workspace"
        let project = store.projectNames[projectId] ?? workStore.projectName(projectId) ?? "Project"
        return "\(workspace) · \(project)"
    }

    @ViewBuilder
    private func row(for entry: AttentionEntry) -> some View {
        switch entry {
        case .decision(let item):
            link(to: InboxDestination.of(item)) {
                WorkDecisionRow(
                    item: item,
                    isBusy: decidingItemId == item.id,
                    onApproveHire: { decide(item) { await store.decideHire(item, approve: true) } },
                    onRejectHire: { decide(item) { await store.decideHire(item, approve: false) } },
                    onApproveSetup: { decide(item) { await store.approveSetup(item) } },
                    onAnswerStandup: { openStandup(item) }
                )
            }
            .listRowBackground(Color.polychat.surface)
        case .attention(let item):
            link(to: InboxDestination.of(item)) {
                AttentionItemRow(item: item)
            }
            .listRowBackground(Color.polychat.surface)
        case .notification(let item):
            link(to: InboxDestination.of(item), onOpen: { markRead(item) }) {
                InboxRow(item: item)
            }
            .listRowBackground(Color.polychat.surface)
            .swipeActions(edge: .trailing) {
                Button(role: .destructive) {
                    Task { await inbox.dismiss(item); await publish() }
                } label: {
                    Label("Dismiss", systemImage: "xmark")
                }
            }
            .swipeActions(edge: .leading) {
                if !item.isRead {
                    Button {
                        Task { await inbox.markRead(item); await publish() }
                    } label: {
                        Label("Read", systemImage: "envelope.open")
                    }
                    .tint(Color.polychat.primary)
                }
            }
        }
    }

    @ViewBuilder
    private func link<Label: View>(
        to destination: InboxDestination,
        onOpen: (() -> Void)? = nil,
        @ViewBuilder label: () -> Label
    ) -> some View {
        switch destination {
        case .web(let deepLink):
            Button {
                onOpen?()
                openURL(WebLinks.url(path: deepLink))
            } label: {
                HStack {
                    label()
                    Image(systemName: "arrow.up.right")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.polychat.textMuted)
                }
            }
        default:
            Button {
                onOpen?()
                path.append(contentsOf: routes(to: destination))
            } label: {
                HStack {
                    label()
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.polychat.textMuted)
                }
            }
        }
    }

    private func routes(to destination: InboxDestination) -> [WorkRoute] {
        switch destination {
        case .task(let projectId, let taskId):
            return [.project(projectId), .task(projectId: projectId, taskId: taskId, interactionId: nil)]
        case .run(let runId):
            return [.run(runId)]
        case .conversation(let conversationId):
            return [.conversation(conversationId)]
        case .project(let projectId):
            return [.project(projectId)]
        case .web:
            return []
        }
    }

    private func sectionHeader(_ title: String, count: Int) -> some View {
        HStack {
            Text(title)
            if count > 0 {
                Text("\(count)")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(Color.polychat.primaryForeground)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.polychat.primary, in: Capsule())
            }
        }
    }

    private func refresh() async {
        await inbox.refresh()
        async let attention: Void = store.refresh(notifications: inbox.items)
        async let mine: Void = workStore.loadMyTasks()
        _ = await (attention, mine)
    }

    private func publish() async {
        await store.publish(notifications: inbox.items)
    }

    private func decide(_ item: WorkInboxItem, action: @escaping () async -> Void) {
        decidingItemId = item.id
        Task {
            await action()
            decidingItemId = nil
            await publish()
        }
    }

    private func openStandup(_ item: WorkInboxItem) {
        Task {
            standupAnswers = await store.standupDraft(for: item)
            if standupAnswers != nil {
                standupItem = item
            }
        }
    }

    private func markRead(_ item: TaskInboxItem) {
        guard !item.isRead else { return }
        Task { await inbox.markRead(item); await publish() }
    }
}

private struct AttentionItemRow: View {
    let item: WorkAttentionItem

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(tint)
                .frame(width: 30, height: 30)
                .background(tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 8, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline) {
                    Text(item.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.polychat.text)
                        .lineLimit(2)
                    Spacer(minLength: 4)
                    if item.isUnread {
                        Circle().fill(Color.polychat.primary).frame(width: 8, height: 8)
                    }
                }
                if let detail = item.detail, !detail.isEmpty {
                    Text(detail)
                        .font(.footnote)
                        .foregroundStyle(Color.polychat.textMuted)
                        .lineLimit(2)
                }
                HStack(spacing: 6) {
                    StatusPill(label: label, tint: tint)
                    Text(RelativeTime.label(for: item.occurredAt))
                        .font(.caption)
                        .foregroundStyle(Color.polychat.textMuted)
                        .lineLimit(1)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private var icon: String {
        switch item.kind {
        case "approval": return "checkmark.shield"
        case "input": return "questionmark.bubble"
        case "review": return "doc.text.magnifyingglass"
        case "failed": return "exclamationmark.triangle"
        case "completed": return "checkmark.circle"
        default: return "bolt.horizontal"
        }
    }

    private var tint: Color {
        switch item.kind {
        case "failed": return Color.polychat.error
        case "completed": return Color.polychat.success
        case "approval", "input", "review": return Color.polychat.attention
        default: return Color.polychat.activeWork
        }
    }

    private var label: String {
        switch item.kind {
        case "approval": return "Approval"
        case "input": return "Needs input"
        case "review": return "Review"
        case "failed": return "Stopped"
        case "completed": return "Done"
        default: return "Running"
        }
    }
}

private struct InboxRow: View {
    let item: TaskInboxItem

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(tint)
                .frame(width: 30, height: 30)
                .background(tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 8, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                Text(item.objective)
                    .font(.subheadline.weight(item.isRead ? .regular : .semibold))
                    .foregroundStyle(Color.polychat.text)
                    .lineLimit(2)
                if let detail = item.detail, !detail.isEmpty {
                    Text(detail)
                        .font(.footnote)
                        .foregroundStyle(Color.polychat.textMuted)
                        .lineLimit(2)
                }
                HStack(spacing: 6) {
                    StatusPill(label: label, tint: tint)
                    Text(RelativeTime.label(for: item.since))
                        .font(.caption)
                        .foregroundStyle(Color.polychat.textMuted)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
            if !item.isRead {
                Circle().fill(Color.polychat.primary).frame(width: 8, height: 8).padding(.top, 6)
            }
        }
        .padding(.vertical, 4)
    }

    private var icon: String {
        switch item.kind {
        case "approval": return "checkmark.shield"
        case "input": return "questionmark.bubble"
        case "review": return "doc.text.magnifyingglass"
        case "blocked": return "exclamationmark.triangle"
        case "assigned": return "person.crop.circle.badge.checkmark"
        case "completion": return "checkmark.circle"
        default: return "bell"
        }
    }

    private var tint: Color {
        switch item.kind {
        case "blocked": return Color.polychat.error
        case "completion": return Color.polychat.success
        case "assigned": return Color.polychat.activeWork
        default: return Color.polychat.attention
        }
    }

    private var label: String {
        switch item.kind {
        case "approval": return "Approval"
        case "input": return "Questions"
        case "review": return "Review"
        case "blocked": return "Stuck"
        case "assigned": return "Yours"
        case "completion": return "Done"
        default: return "Update"
        }
    }
}

private struct BackgroundTaskRow: View {
    let task: BackgroundTask

    var body: some View {
        HStack(spacing: 12) {
            Group {
                if task.isActive {
                    ProgressView().controlSize(.small)
                } else {
                    Image(systemName: "exclamationmark.triangle")
                        .foregroundStyle(Color.polychat.error)
                }
            }
            .frame(width: 30)

            VStack(alignment: .leading, spacing: 2) {
                Text(task.title)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Color.polychat.text)
                Text(task.errorMessage ?? (task.status ?? "queued").capitalized)
                    .font(.caption)
                    .foregroundStyle(Color.polychat.textMuted)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 2)
    }
}
