import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var authManager: AuthenticationManager
    @EnvironmentObject private var store: DiscoverStore
    @Environment(\.openURL) private var openURL
    @State private var mediaItem: DiscoverMediaItem?
    @State private var selectedCard: DiscoverCard?
    let onAsk: (String) -> Void

    private let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    header

                    if let error = store.error {
                        InlineErrorBanner(message: error) {
                            Task { await store.refresh() }
                        }
                    }

                    if let discover = store.discover {
                        if let edition = discover.edition {
                            editionContent(edition)
                        } else if discover.settings.enabled {
                            DiscoverPlaceholder(isWriting: store.isWriting) {
                                Task { await store.writeNow() }
                            }
                        } else {
                            DiscoverIntro {
                                Task { await store.turnOn() }
                            }
                        }
                    } else if store.isLoading {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .padding(.top, 60)
                    }
                }
                .frame(maxWidth: 760)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
            .background(Color.polychat.background)
            .navigationTitle("Home")
            .toolbar(.hidden, for: .navigationBar)
            .refreshable { await store.refresh() }
            .task { await store.refresh() }
            .sheet(item: $selectedCard) { card in
                DiscoverCardSheet(
                    card: card,
                    cover: card.coverId.flatMap { store.covers[$0] },
                    onAsk: {
                        selectedCard = nil
                        onAsk(card.chatPrompt)
                    },
                    onOpenLink: { openLink(card) },
                    onFeedback: { signal in
                        selectedCard = nil
                        Task { await store.send(signal, for: card) }
                    }
                )
                .presentationDetents([.medium, .large])
            }
            .sheet(item: $mediaItem) { item in
                if let edition = store.discover?.edition {
                    DiscoverMediaSheet(
                        item: item,
                        edition: edition,
                        windDownId: store.discover?.windDownId,
                        artwork: store.mediaArt[item],
                        onRefresh: { await store.refresh() }
                    )
                    .onDisappear { Task { await store.loadMedia() } }
                }
            }
        }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                EyebrowLabel(
                    (store.isEveningEdition ? "Evening edition · " : "")
                        + Date().formatted(.dateTime.weekday(.wide).day().month(.wide))
                )
                Text(greeting)
                    .font(.polychatDisplay(.largeTitle))
                    .foregroundStyle(Color.polychat.text)
            }
            Spacer()
            if store.discover?.settings.enabled == true {
                Menu {
                    Button {
                        Task { await store.writeNow() }
                    } label: {
                        Label("Write today's edition again", systemImage: "arrow.clockwise")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Color.polychat.textMuted)
                        .frame(width: 36, height: 36)
                        .background(Color.polychat.surface, in: Circle())
                        .overlay(Circle().stroke(Color.polychat.border, lineWidth: 1))
                }
                .accessibilityLabel("Edition options")
            }
        }
        .padding(.top, 12)
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        let opener = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
        guard let name = authManager.user?.name?.split(separator: " ").first else {
            return opener
        }
        return "\(opener), \(name)"
    }

    @ViewBuilder
    private func editionContent(_ edition: DiscoverEdition) -> some View {
        if !edition.brief.isEmpty {
            DiscoverBriefCard(lines: edition.brief, onOpen: open)
        }

        if !store.visibleMedia.isEmpty {
            DiscoverMediaShelf(items: store.visibleMedia, states: store.media, art: store.mediaArt) { mediaItem = $0 }
        }

        let topics = store.cards(in: .topics)
        if !topics.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                EyebrowLabel(DiscoverSection.topics.title)
                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(topics) { card in
                        DiscoverTopicTile(card: card, cover: card.coverId.flatMap { store.covers[$0] }) {
                            selectedCard = card
                        }
                        .contextMenu { feedbackMenu(card) }
                    }
                }
            }
        }

        ForEach(DiscoverSection.allCases.filter { $0 != .topics }, id: \.self) { section in
            let cards = store.cards(in: section)
            if !cards.isEmpty {
                VStack(alignment: .leading, spacing: 12) {
                    EyebrowLabel(section.title)
                    VStack(spacing: 0) {
                        ForEach(Array(cards.enumerated()), id: \.element.id) { index, card in
                            if index > 0 {
                                Divider().padding(.leading, 52)
                            }
                            DiscoverRow(card: card) { selectedCard = card }
                                .contextMenu { feedbackMenu(card) }
                        }
                    }
                    .background(Color.polychat.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Color.polychat.border, lineWidth: 1))
                }
            }
        }

        if let interests = edition.interests, !interests.isEmpty {
            Text("Built around \(interests.map(\.topic).joined(separator: " · "))")
                .font(.caption)
                .foregroundStyle(Color.polychat.textMuted)
        }
    }

    @ViewBuilder
    private func feedbackMenu(_ card: DiscoverCard) -> some View {
        Button {
            onAsk(card.chatPrompt)
        } label: {
            Label("Ask Poly about this", systemImage: "bubble.left")
        }
        Button {
            Task { await store.send("more", for: card) }
        } label: {
            Label("More like this", systemImage: "hand.thumbsup")
        }
        Button {
            Task { await store.send("less", for: card) }
        } label: {
            Label("Less like this", systemImage: "hand.thumbsdown")
        }
        Button(role: .destructive) {
            Task { await store.send("hide", for: card) }
        } label: {
            Label("Hide", systemImage: "eye.slash")
        }
    }

    private func openLink(_ card: DiscoverCard) {
        guard let url = card.externalURL else { return }
        Task { await store.send("opened", for: card) }
        openURL(url)
    }

    private func open(_ line: DiscoverBriefLine) {
        if let href = line.href, let url = URL(string: href), url.scheme?.hasPrefix("http") == true {
            openURL(url)
        } else if let href = line.href, let url = URL(string: "polychat:/\(href)") {
            openURL(url)
        }
    }
}

private struct DiscoverBriefCard: View {
    let lines: [DiscoverBriefLine]
    let onOpen: (DiscoverBriefLine) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(lines) { line in
                Button {
                    if line.href != nil {
                        onOpen(line)
                    }
                } label: {
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: line.systemImage)
                            .font(.subheadline)
                            .foregroundStyle(Color.polychat.primary)
                            .frame(width: 22)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(line.label)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Color.polychat.textMuted)
                            Text(line.text)
                                .font(.subheadline)
                                .foregroundStyle(Color.polychat.text)
                                .multilineTextAlignment(.leading)
                        }
                        Spacer(minLength: 0)
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .polychatCard()
    }
}

private struct DiscoverTopicTile: View {
    let card: DiscoverCard
    let cover: UIImage?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 0) {
                ZStack(alignment: .bottomLeading) {
                    if let cover {
                        Image(uiImage: cover)
                            .resizable()
                            .scaledToFill()
                    } else {
                        LinearGradient(
                            colors: [Color.polychat.primary.opacity(0.55), Color.polychat.creative.opacity(0.45)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    }
                }
                .frame(height: 96)
                .frame(maxWidth: .infinity)
                .clipped()

                VStack(alignment: .leading, spacing: 4) {
                    if let topic = card.topic {
                        Text(topic.uppercased())
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(Color.polychat.textMuted)
                            .lineLimit(1)
                    }
                    Text(card.headline)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.polychat.text)
                        .lineLimit(3)
                        .multilineTextAlignment(.leading)
                }
                .padding(10)
                .frame(maxWidth: .infinity, minHeight: 84, alignment: .topLeading)
            }
            .background(Color.polychat.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Color.polychat.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

private struct DiscoverRow: View {
    let card: DiscoverCard
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: card.systemImage)
                    .font(.subheadline)
                    .foregroundStyle(Color.polychat.primary)
                    .frame(width: 28, height: 28)
                    .background(Color.polychat.selection, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                VStack(alignment: .leading, spacing: 3) {
                    Text(card.headline)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.polychat.text)
                        .multilineTextAlignment(.leading)
                    if let body = card.body {
                        Text(body)
                            .font(.footnote)
                            .foregroundStyle(Color.polychat.textMuted)
                            .lineLimit(3)
                            .multilineTextAlignment(.leading)
                    }
                    let meta = [card.source, card.when, card.where].compactMap { $0 }
                    if !meta.isEmpty {
                        Text(meta.joined(separator: " · "))
                            .font(.caption)
                            .foregroundStyle(Color.polychat.textMuted)
                    }
                }
                Spacer(minLength: 0)
                Image(systemName: card.externalURL == nil ? "bubble.left" : "arrow.up.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.polychat.textMuted)
                    .padding(.top, 4)
            }
            .padding(14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

private struct DiscoverIntro: View {
    let onTurnOn: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            PolyMark(size: 56)
            Text("A morning edition, made for you")
                .font(.polychatDisplay(.title2))
            Text("Each morning Poly reads what you've been working on and leaves an edition here: a short brief, topics worth a look, links and things worth doing next.")
                .font(.subheadline)
                .foregroundStyle(Color.polychat.textMuted)
            Button("Turn on Discover", action: onTurnOn)
                .buttonStyle(.borderedProminent)
                .tint(Color.polychat.primary)
        }
        .polychatCard(padding: 20)
    }
}

private struct DiscoverPlaceholder: View {
    let isWriting: Bool
    let onWrite: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(isWriting ? "Out gathering" : "Nothing on the perch yet")
                .font(.polychatDisplay(.title3))
            Text(isWriting
                 ? "Poly is reading up on your topics. Pull to refresh in a minute or two."
                 : "Your first edition arrives tomorrow morning, or Poly can write one now.")
                .font(.subheadline)
                .foregroundStyle(Color.polychat.textMuted)
            if !isWriting {
                Button("Write today's edition", action: onWrite)
                    .buttonStyle(.borderedProminent)
                    .tint(Color.polychat.primary)
            } else {
                ProgressView()
            }
        }
        .polychatCard(padding: 20)
    }
}

private struct DiscoverCardSheet: View {
    let card: DiscoverCard
    let cover: UIImage?
    let onAsk: () -> Void
    let onOpenLink: () -> Void
    let onFeedback: (String) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if let cover {
                    Image(uiImage: cover)
                        .resizable()
                        .scaledToFill()
                        .frame(height: 160)
                        .frame(maxWidth: .infinity)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                if let label = card.topic ?? card.source {
                    EyebrowLabel(label)
                }
                Text(card.headline)
                    .font(.polychatDisplay(.title3))
                    .foregroundStyle(Color.polychat.text)
                if let body = card.body {
                    Text(body)
                        .font(.body)
                        .foregroundStyle(Color.polychat.text)
                }
                Text(card.reason)
                    .font(.footnote)
                    .foregroundStyle(Color.polychat.textMuted)

                VStack(spacing: 10) {
                    Button(action: onAsk) {
                        Label("Start a chat about this", systemImage: "bubble.left.and.text.bubble.right")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .tint(Color.polychat.primary)

                    if card.externalURL != nil {
                        Button(action: onOpenLink) {
                            Label("Open \(card.source ?? "link")", systemImage: "arrow.up.right")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.large)
                    }
                }

                HStack(spacing: 16) {
                    Button("More like this") { onFeedback("more") }
                    Button("Less like this") { onFeedback("less") }
                    Spacer()
                    Button("Hide", role: .destructive) { onFeedback("hide") }
                }
                .font(.footnote.weight(.medium))
            }
            .padding(20)
        }
        .background(Color.polychat.background)
    }
}
