import SwiftUI

struct DiscoverItemPanel: View {
    @EnvironmentObject private var store: DiscoverStore
    @EnvironmentObject private var playback: DiscoverPlayback
    @EnvironmentObject private var conversationManager: ConversationManager
    @Environment(\.openURL) private var openURL
    @State private var current: DiscoverItem
    @State private var direction = 1
    let onOpenConversation: (String) -> Void

    init(item: DiscoverItem, onOpenConversation: @escaping (String) -> Void) {
        _current = State(initialValue: item)
        self.onOpenConversation = onOpenConversation
    }

    private var items: [DiscoverItem] { store.items }

    private var openConversationId: String? {
        guard let edition = store.edition(for: current), current.subject(in: edition) != nil,
              let conversation = conversationManager.currentConversation,
              !conversation.messages.isEmpty else { return nil }
        return conversation.id
    }

    var body: some View {
        VStack(spacing: 0) {
            if current.card != nil, let playing = playback.current {
                StillPlayingBar(item: playing) { show(.media(playing), direction: -1) }
            }
            if let edition = store.edition(for: current) {
                DiscoverItemContent(
                    item: current,
                    edition: edition,
                    onOpenLink: openLink,
                    onSelect: { show(.card($0), direction: 1) }
                )
                .id(current.id)
                .transition(.asymmetric(
                    insertion: .move(edge: direction > 0 ? .bottom : .top).combined(with: .opacity),
                    removal: .opacity
                ))
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .background(Color.polychat.background)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .tabBar)
        .modifier(PanelTitle(
            title: current.label,
            subtitle: DiscoverItem.position(of: current, in: items)
        ))
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button { step(-1) } label: { Image(systemName: "chevron.up") }
                    .accessibilityLabel("Previous item")
                    .disabled(items.isEmpty)
                Button { step(1) } label: { Image(systemName: "chevron.down") }
                    .accessibilityLabel("Next item")
                    .disabled(items.isEmpty)
                menu
            }
        }
        .onDisappear { Task { await store.loadMedia() } }
    }

    private var menu: some View {
        Menu {
            if let card = current.card {
                let signals = store.signals(for: card)
                let saved = signals.contains("saved")
                Button {
                    Task { await store.send("saved", for: card) }
                } label: {
                    Label(saved ? "Saved" : "Save", systemImage: saved ? "bookmark.fill" : "bookmark")
                }
                .disabled(saved)
                if card.topic != nil {
                    feedbackButton("More like this", systemImage: "hand.thumbsup", signal: "more", card: card, signals: signals)
                    feedbackButton("Less like this", systemImage: "hand.thumbsdown", signal: "less", card: card, signals: signals)
                    feedbackButton("Hide this topic", systemImage: "eye.slash", signal: "hide", card: card, signals: signals)
                }
                if let url = card.externalURL {
                    ShareLink(item: url, subject: Text(card.headline)) {
                        Label("Share", systemImage: "square.and.arrow.up")
                    }
                }
            }
            if let openConversationId {
                Button {
                    onOpenConversation(openConversationId)
                } label: {
                    Label("Open as a chat", systemImage: "arrow.up.left.and.arrow.down.right")
                }
            }
        } label: {
            Image(systemName: "ellipsis")
        }
        .accessibilityLabel("More options")
    }

    private func feedbackButton(_ title: String, systemImage: String, signal: String, card: DiscoverCard, signals: [String]) -> some View {
        Button {
            Task {
                await store.send(signal, for: card)
                if signal == "hide" { step(1) }
            }
        } label: {
            Label(title, systemImage: signals.contains(signal) ? "checkmark" : systemImage)
        }
    }

    private func step(_ by: Int) {
        guard let next = DiscoverItem.step(items, from: current, by: by) else { return }
        show(next, direction: by)
    }

    private func show(_ item: DiscoverItem, direction: Int) {
        self.direction = direction
        withAnimation(.spring(response: 0.36, dampingFraction: 0.86)) {
            current = item
        }
    }

    private func openLink(_ card: DiscoverCard) {
        guard let url = card.externalURL else { return }
        Task { await store.send("opened", for: card) }
        openURL(url)
    }
}

private struct PanelTitle: ViewModifier {
    let title: String
    let subtitle: String?

    func body(content: Content) -> some View {
        if #available(iOS 26, *) {
            content
                .navigationTitle(title)
                .navigationSubtitle(subtitle ?? "")
        } else {
            content
                .navigationTitle(title)
                .toolbar {
                    ToolbarItem(placement: .principal) {
                        VStack(spacing: 1) {
                            Text(title)
                                .font(.headline)
                                .foregroundStyle(Color.polychat.text)
                            if let subtitle {
                                Text(subtitle)
                                    .font(.caption2.monospacedDigit())
                                    .foregroundStyle(Color.polychat.textMuted)
                            }
                        }
                    }
                }
        }
    }
}

private struct StillPlayingBar: View {
    let item: DiscoverMediaItem
    let onBack: () -> Void

    var body: some View {
        Button(action: onBack) {
            HStack(spacing: 8) {
                Image(systemName: "waveform")
                    .foregroundStyle(Color.polychat.primary)
                Text("Still playing \(item.title)")
                    .foregroundStyle(Color.polychat.textMuted)
                Spacer(minLength: 0)
                Text("Back to it")
                    .fontWeight(.medium)
                    .foregroundStyle(Color.polychat.text)
            }
            .font(.caption)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(Color.polychat.surface)
            .overlay(alignment: .bottom) { Divider() }
        }
        .buttonStyle(.plain)
    }
}
