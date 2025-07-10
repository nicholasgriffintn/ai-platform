import SwiftUI

struct ConversationListView: View {
    @EnvironmentObject var conversationManager: ConversationManager
    
    var body: some View {
        List {
            ForEach(conversationManager.conversations) { conversation in
                Button(action: {
                    conversationManager.currentConversation = conversation
                }) {
                    HStack {
                        VStack(alignment: .leading) {
                            Text(conversation.title)
                                .font(.headline)
                                .foregroundColor(.primary)
                            if let lastMessage = conversation.messages.last {
                                Text(lastMessage.content)
                                    .font(.subheadline)
                                    .lineLimit(1)
                                    .foregroundColor(.gray)
                            }
                        }
                        Spacer()
                        if conversation.id == conversationManager.currentConversation?.id {
                            Image(systemName: "checkmark")
                                .foregroundColor(.blue)
                        }
                    }
                }
                .buttonStyle(PlainButtonStyle())
            }
            .onDelete(perform: deleteConversations)
        }
        .navigationTitle("Conversations")
        .toolbar {
            Button(action: startNewConversation) {
                Image(systemName: "plus")
            }
        }
    }
    
    private func startNewConversation() {
        conversationManager.startNewConversation()
    }
    
    private func deleteConversations(at offsets: IndexSet) {
        offsets.forEach { index in
            let conversation = conversationManager.conversations[index]
            if conversation.id == conversationManager.currentConversation?.id {
                conversationManager.currentConversation = nil
            }
            // TODO: Implement actual deletion from storage
        }
        conversationManager.conversations.remove(atOffsets: offsets)
    }
}
