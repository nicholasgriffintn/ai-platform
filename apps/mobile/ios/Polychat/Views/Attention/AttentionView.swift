import SwiftUI

struct AttentionView: View {
    @EnvironmentObject private var store: AttentionStore
    @EnvironmentObject private var inbox: TaskNotificationManager
    @Binding var selectedTarget: MobileWorkTarget?
    let onOpenConversation: (String) -> Void

    private var isEmpty: Bool {
        store.workItems.isEmpty && inbox.items.isEmpty && store.visibleBackgroundTasks.isEmpty
    }

    var body: some View {
        NavigationStack {
            List {
                if let error = store.error ?? inbox.error {
                    InlineErrorBanner(message: error) {
                        Task { await refresh() }
                    }
                    .listRowSeparator(.hidden)
                    .listRowBackground(Color.clear)
                }

                if !store.actionableItems.isEmpty {
                    Section {
                        ForEach(store.actionableItems) { item in
                            Button { selectedTarget = item.target } label: {
                                AttentionItemRow(item: item)
                            }
                        }
                    } header: {
                        sectionHeader("Needs you", count: store.actionableItems.count)
                    }
                }

                if !inbox.items.isEmpty {
                    Section {
                        ForEach(inbox.items) { item in
                            Button { open(item) } label: {
                                InboxRow(item: item)
                            }
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
                    } header: {
                        sectionHeader("Inbox", count: inbox.unread)
                    }
                }

                if !store.otherItems.isEmpty {
                    Section {
                        ForEach(store.otherItems) { item in
                            Button { selectedTarget = item.target } label: {
                                AttentionItemRow(item: item)
                            }
                        }
                    } header: {
                        sectionHeader("Project work", count: 0)
                    }
                }

                if !store.visibleBackgroundTasks.isEmpty {
                    Section {
                        ForEach(store.visibleBackgroundTasks) { task in
                            BackgroundTaskRow(task: task)
                        }
                    } header: {
                        sectionHeader("Background tasks", count: 0)
                    }
                }

                if isEmpty && !store.isLoading && !inbox.isLoading {
                    ContentUnavailableView {
                        Label("Nothing is waiting on you", systemImage: "checkmark.circle")
                    } description: {
                        Text(store.workUnavailable
                             ? "Inbox notifications and background tasks land here. Shared project work needs a Work plan."
                             : "Approvals, questions, reviews and running work from every device land here.")
                    }
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Color.polychat.background)
            .navigationTitle("Attention")
            .refreshable { await refresh() }
            .task { await refresh() }
            .overlay {
                if isEmpty && (store.isLoading || inbox.isLoading) {
                    ProgressView()
                }
            }
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
        await store.refresh(inboxUnread: inbox.unread)
    }

    private func publish() async {
        await store.publish(inboxUnread: inbox.unread)
    }

    private func open(_ item: TaskInboxItem) {
        if !item.isRead {
            Task { await inbox.markRead(item); await publish() }
        }
        selectedTarget = MobileWorkTarget(
            workspaceId: item.workspaceId,
            projectId: item.projectId,
            conversationId: item.conversationId,
            taskId: item.taskId,
            runId: nil,
            interactionId: nil
        )
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
                    Text("\(item.projectName) · \(RelativeTime.label(for: item.occurredAt))")
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
            Image(systemName: item.requiresAction ? "bell.badge" : "bell")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(item.requiresAction ? Color.polychat.attention : Color.polychat.textMuted)
                .frame(width: 30, height: 30)
                .background(Color.polychat.surfaceElevated, in: RoundedRectangle(cornerRadius: 8, style: .continuous))

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
                Text("\(item.projectName) · \(RelativeTime.label(for: item.since))")
                    .font(.caption)
                    .foregroundStyle(Color.polychat.textMuted)
            }
            Spacer(minLength: 0)
            if !item.isRead {
                Circle().fill(Color.polychat.primary).frame(width: 8, height: 8).padding(.top, 6)
            }
        }
        .padding(.vertical, 4)
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
