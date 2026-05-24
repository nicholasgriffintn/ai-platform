import SwiftUI

struct ConversationListView: View {
    @EnvironmentObject var conversationManager: ConversationManager
    @Binding var selectedConversationID: String?
    @State private var searchText = ""

    private var filteredConversations: [Conversation] {
        if searchText.isEmpty {
            return conversationManager.conversations
        }
        return conversationManager.conversations.filter { conversation in
            conversation.title.localizedCaseInsensitiveContains(searchText) ||
            conversation.messages.contains { message in
                message.textContent.localizedCaseInsensitiveContains(searchText)
            }
        }
    }

    private var categorizedConversations: [(String, [Conversation])] {
        let calendar = Calendar.current
        let now = Date()

        var categories: [String: [Conversation]] = [
            "Today": [],
            "Yesterday": [],
            "This Week": [],
            "This Month": [],
            "Older": []
        ]

        for conversation in filteredConversations {
            let activityDate = conversation.activityDate

            if calendar.isDateInToday(activityDate) {
                categories["Today"]?.append(conversation)
            } else if calendar.isDateInYesterday(activityDate) {
                categories["Yesterday"]?.append(conversation)
            } else if calendar.isDate(activityDate, equalTo: now, toGranularity: .weekOfYear) {
                categories["This Week"]?.append(conversation)
            } else if calendar.isDate(activityDate, equalTo: now, toGranularity: .month) {
                categories["This Month"]?.append(conversation)
            } else {
                categories["Older"]?.append(conversation)
            }
        }

        return [
            ("Today", categories["Today"] ?? []),
            ("Yesterday", categories["Yesterday"] ?? []),
            ("This Week", categories["This Week"] ?? []),
            ("This Month", categories["This Month"] ?? []),
            ("Older", categories["Older"] ?? [])
        ].filter { !$0.1.isEmpty }
    }

    var body: some View {
        ZStack {
            List(selection: $selectedConversationID) {
                ForEach(categorizedConversations, id: \.0) { category, conversations in
                    Section(header: Text(category).font(.subheadline).fontWeight(.semibold)) {
                        ForEach(conversations) { conversation in
                            NavigationLink(value: conversation.id) {
                                ConversationRow(
                                    conversation: conversation,
                                    isSelected: conversation.id == selectedConversationID
                                )
                            }
                            .buttonStyle(PlainButtonStyle())
                            .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                        }
                        .onDelete { offsets in
                            deleteConversations(from: conversations, at: offsets)
                        }
                    }
                }

                if filteredConversations.isEmpty && !searchText.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 40))
                            .foregroundColor(.gray)
                        Text("No conversations found")
                            .font(.headline)
                            .foregroundColor(.gray)
                        Text("Try a different search term")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)
                    .listRowBackground(Color.clear)
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .refreshable {
                await conversationManager.refreshConversations()
            }

            if conversationManager.isLoading && conversationManager.conversations.isEmpty {
                ProgressView("Loading conversations...")
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(10)
                    .shadow(radius: 5)
            }
        }
        .background(Color(.systemGroupedBackground))
        .searchable(text: $searchText, prompt: "Search conversations...")
        .navigationTitle("Conversations")
        .toolbar {
            Button(action: startNewConversation) {
                Image(systemName: "plus")
            }
        }
        .alert("Error", isPresented: .constant(conversationManager.error != nil)) {
            Button("OK") {
                conversationManager.error = nil
            }
        } message: {
            if let error = conversationManager.error {
                Text(error)
            }
        }
    }

    private func startNewConversation() {
        let conversation = conversationManager.startNewConversation()
        selectedConversationID = conversation.id
    }

    private func deleteConversations(from conversations: [Conversation], at offsets: IndexSet) {
        Task {
            for index in offsets {
                let conversation = conversations[index]
                await conversationManager.deleteConversation(conversation)
            }
        }
    }
}

struct ConversationRow: View {
    let conversation: Conversation
    let isSelected: Bool

    private var lastMessagePreview: String {
        guard let lastMessage = conversation.messages.last(where: { $0.role == "user" || $0.role == "assistant" }) else {
            return "No messages yet"
        }
        return lastMessage.content.textValue
    }

    private var messageCount: Int {
        conversation.messageCount
    }

    private var messageCountText: String {
        if messageCount == 0 {
            return "No messages"
        }

        if messageCount == 1 {
            return "1 message"
        }

        return "\(messageCount) messages"
    }

    private var activityText: String {
        let prefix = conversation.lastMessageAt == nil ? "Created" : "Updated"
        return "\(prefix) \(relativeDate(from: conversation.activityDate))"
    }

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 5) {
                HStack {
                    Text(conversation.title)
                        .font(.headline)
                        .foregroundColor(.primary)
                        .lineLimit(1)
                    Spacer()
                }

                Text(lastMessagePreview)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(1)

                HStack(spacing: 6) {
                    Text(messageCountText)
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Text("•")
                        .font(.caption)
                        .foregroundColor(Color(.tertiaryLabel))

                    Text(activityText)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .lineLimit(1)
            }
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 12)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(isSelected ? Color.polychat.primary.opacity(0.1) : Color(.systemGray6))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(isSelected ? Color.polychat.primary.opacity(0.25) : Color(.systemGray5), lineWidth: 1)
        )
        .contentShape(Rectangle())
    }

    private func relativeDate(from date: Date) -> String {
        let now = Date()
        let seconds = date.timeIntervalSince(now)

        if seconds > 0 || abs(seconds) < 60 {
            return "just now"
        }

        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: now)
    }
}

private extension Conversation {
    var activityDate: Date {
        lastMessageAt ?? createdAt
    }
}

#Preview {
    NavigationSplitView {
        ConversationListView(selectedConversationID: .constant(nil))
            .environmentObject(ConversationManager())
    } detail: {
        Text("Conversation")
    }
}
