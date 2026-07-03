import SwiftUI
struct MessageListView: View {
    let messages: [ChatMessage]
    let conversationModelId: String?
    let isLoadingConversation: Bool
    let onSuggestionSelected: (String) -> Void
    let onDismissKeyboard: () -> Void
    
    var body: some View {
        ScrollView {
            ScrollViewReader { proxy in
                LazyVStack(spacing: 22) {
                    if isLoadingConversation {
                        LoadingConversationMessagesView()
                            .padding(.top, 150)
                    } else if messages.isEmpty {
                        WelcomePromptView(onSuggestionSelected: onSuggestionSelected)
                            .padding(.top, 150)
                    } else {
                        ForEach(messages) { message in
                            if message.isVisibleCompactionStatus {
                                CompactionStatusRow(label: message.compactionStatusLabel)
                                    .id(message.id)
                            } else {
                                MessageBubble(message: message, conversationModelId: conversationModelId)
                                    .id(message.id)
                            }
                        }
                    }
                }
                .frame(maxWidth: 860)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 28)
                .padding(.top, messages.isEmpty ? 28 : 72)
                .padding(.bottom, 28)
                .onChange(of: messages.count) {
                    if let lastMessageId = messages.last?.id {
                        withAnimation {
                            proxy.scrollTo(lastMessageId, anchor: .bottom)
                        }
                    }
                }
                .onChange(of: messages.last?.textContent) {
                    if let lastMessageId = messages.last?.id {
                        withAnimation(.easeOut(duration: 0.18)) {
                            proxy.scrollTo(lastMessageId, anchor: .bottom)
                        }
                    }
                }
            }
        }
        .background(Color.polychat.background)
        .contentShape(Rectangle())
        .onTapGesture(perform: onDismissKeyboard)
        #if os(iOS)
        .scrollDismissesKeyboard(.interactively)
        #endif
    }
}

private struct CompactionStatusRow: View {
    let label: String

    var body: some View {
        HStack(spacing: 12) {
            Rectangle()
                .fill(Color.polychat.border)
                .frame(height: 1)
            Label(label, systemImage: "doc.text")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
                .lineLimit(1)
            Rectangle()
                .fill(Color.polychat.border)
                .frame(height: 1)
        }
        .padding(.vertical, 8)
    }
}

private struct LoadingConversationMessagesView: View {
    var body: some View {
        VStack(spacing: 12) {
            ProgressView()
            Text("Loading conversation...")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }
}

private struct WelcomePromptView: View {
    private let suggestions = [
        ("shield", "Existential inquiry", "What makes an answer useful when the question is ambiguous?"),
        ("face.smiling", "Satirical news", "Write a short satirical news brief about robots asking for coffee breaks.")
    ]
    let onSuggestionSelected: (String) -> Void

    var body: some View {
        VStack(spacing: 18) {
            PolychatLogoView(size: 72)
            VStack(spacing: 8) {
                Text("What would you like to know?")
                    .font(.system(size: 34, weight: .bold))
                    .multilineTextAlignment(.center)
                Text("I'm a helpful assistant that can answer questions about basically anything.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            VStack(alignment: .leading, spacing: 10) {
                Text("Try asking about...")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    ForEach(suggestions, id: \.1) { icon, title, prompt in
                        Button {
                            onSuggestionSelected(prompt)
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: icon)
                                    .frame(width: 18)
                                Text(title)
                                    .lineLimit(1)
                                Spacer()
                            }
                            .font(.subheadline.weight(.medium))
                            .padding(.horizontal, 14)
                            .frame(height: 48)
                            .background(Color.polychat.elevatedBackground)
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .stroke(Color.polychat.border, lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .frame(maxWidth: 620)
            .padding(.top, 20)
        }
    }
}
