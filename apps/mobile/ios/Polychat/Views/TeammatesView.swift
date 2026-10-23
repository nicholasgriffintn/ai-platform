import SwiftUI

struct TeammatesView: View {
    @EnvironmentObject var teammatesStore: TeammatesStore
    @Environment(\.dismiss) private var dismiss

    let onOpenConversation: (TeammateRosterRow) -> Void
    let onStartConversation: (TeammateSummary) -> Void

    var body: some View {
        NavigationStack {
            Group {
                if teammatesStore.isLoading && teammatesStore.teammates.isEmpty {
                    ProgressView("Gathering the flock…")
                } else if teammatesStore.rows.isEmpty && teammatesStore.startable.isEmpty {
                    ContentUnavailableView(
                        "No teammates yet",
                        systemImage: "person.2",
                        description: Text("Hire a teammate on the web and it will perch here.")
                    )
                } else {
                    List {
                        if !teammatesStore.rows.isEmpty {
                            Section("Talking with") {
                                ForEach(teammatesStore.rows) { row in
                                    Button {
                                        dismiss()
                                        onOpenConversation(row)
                                    } label: {
                                        TeammateRosterRowView(row: row)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }

                        if !teammatesStore.startable.isEmpty {
                            Section("Start a conversation") {
                                ForEach(teammatesStore.startable) { teammate in
                                    Button {
                                        dismiss()
                                        onStartConversation(teammate)
                                    } label: {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(teammate.name).font(.body)
                                            if !teammate.description.isEmpty {
                                                Text(teammate.description)
                                                    .font(.caption)
                                                    .foregroundStyle(.secondary)
                                                    .lineLimit(2)
                                            }
                                        }
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                    .refreshable {
                        await teammatesStore.refresh()
                    }
                }
            }
            .navigationTitle("Teammates")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .safeAreaInset(edge: .bottom) {
                if let error = teammatesStore.error {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .padding()
                }
            }
            .task {
                await teammatesStore.refresh()
            }
        }
    }
}

private struct TeammateRosterRowView: View {
    let row: TeammateRosterRow

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: isGroup ? "person.3" : "person.crop.circle")
                .foregroundStyle(.secondary)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(row.title).font(.body)
                if !row.subtitle.isEmpty {
                    Text(row.subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer()
            if row.entry.unread {
                Circle()
                    .fill(Color.accentColor)
                    .frame(width: 8, height: 8)
                    .accessibilityLabel("Unread")
            }
        }
        .contentShape(Rectangle())
    }

    private var isGroup: Bool {
        if case .group = row.entry { return true }
        return false
    }
}
