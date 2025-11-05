import SwiftUI

struct ConversationListView: View {
    @EnvironmentObject var conversationManager: ConversationManager
    @State private var searchText = ""

    private var filteredConversations: [Conversation] {
        if searchText.isEmpty {
            return conversationManager.conversations
        }
        return conversationManager.conversations.filter { conversation in
            conversation.title.localizedCaseInsensitiveContains(searchText) ||
            conversation.messages.contains { message in
                message.content.localizedCaseInsensitiveContains(searchText)
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
            if calendar.isDateInToday(conversation.createdAt) {
                categories["Today"]?.append(conversation)
            } else if calendar.isDateInYesterday(conversation.createdAt) {
                categories["Yesterday"]?.append(conversation)
            } else if calendar.isDate(conversation.createdAt, equalTo: now, toGranularity: .weekOfYear) {
                categories["This Week"]?.append(conversation)
            } else if calendar.isDate(conversation.createdAt, equalTo: now, toGranularity: .month) {
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
            List {
                ForEach(categorizedConversations, id: \.0) { category, conversations in
                    Section(header: Text(category).font(.subheadline).fontWeight(.semibold)) {
                        ForEach(conversations) { conversation in
                            Button(action: {
                                Task {
                                    await conversationManager.loadConversationMessages(conversation)
                                }
                            }) {
                                ConversationRow(
                                    conversation: conversation,
                                    isSelected: conversation.id == conversationManager.currentConversation?.id
                                )
                            }
                            .buttonStyle(PlainButtonStyle())
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
                }
            }
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
        conversationManager.startNewConversation()
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
        return lastMessage.content
    }

    private var messageCount: Int {
        conversation.messages.filter { $0.role == "user" || $0.role == "assistant" }.count
    }

    var body: some View {
        HStack(spacing: 12) {
            // Icon
            ZStack {
                Circle()
                    .fill(isSelected ? Color.blue.opacity(0.1) : Color(.systemGray6))
                    .frame(width: 40, height: 40)
                Image(systemName: "message.fill")
                    .font(.system(size: 16))
                    .foregroundColor(isSelected ? .blue : .secondary)
            }

            // Content
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(conversation.title)
                        .font(.headline)
                        .foregroundColor(.primary)
                        .lineLimit(1)
                    Spacer()
                    if isSelected {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.blue)
                            .font(.subheadline)
                    }
                }

                Text(lastMessagePreview)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(2)

                HStack(spacing: 8) {
                    Label("\(messageCount)", systemImage: "bubble.left.and.bubble.right")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Text(relativeDate(from: conversation.createdAt))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func relativeDate(from date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}
