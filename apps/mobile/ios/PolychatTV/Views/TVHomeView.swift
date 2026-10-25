import SwiftUI

struct TVHomeView: View {
    @EnvironmentObject private var signIn: DeviceSignIn
    @EnvironmentObject private var store: DiscoverStore
    let name: String?

    var body: some View {
        ZStack {
            TVBackdrop()

            ScrollView {
                VStack(alignment: .leading, spacing: 64) {
                    header

                    if let discover = store.discover {
                        if let edition = discover.edition {
                            editionContent(edition)
                        } else if discover.settings.enabled {
                            notice(
                                title: store.isWriting ? "Out gathering" : "Nothing on the perch yet",
                                message: store.isWriting
                                    ? "Poly is reading up on your topics. This screen updates when the edition lands."
                                    : "Your first edition arrives tomorrow morning, or Poly can write one now.",
                                actionTitle: store.isWriting ? nil : "Write today's edition"
                            ) {
                                Task { await store.writeNow() }
                            }
                        } else {
                            notice(
                                title: "A morning edition, made for you",
                                message: "Each morning Poly reads what you've been working on and leaves an edition here: a short brief, topics worth a look and things worth doing next.",
                                actionTitle: "Turn on Discover"
                            ) {
                                Task { await store.turnOn() }
                            }
                        }
                    } else if store.isLoading {
                        ProgressView().frame(maxWidth: .infinity)
                    }

                    if let error = store.error {
                        Text(error)
                            .font(.callout)
                            .foregroundStyle(Color.polychat.attention)
                    }

                    Button("Sign out of this Apple TV") {
                        TopShelfStore.clear()
                        signIn.signOut()
                    }
                    .font(.callout)
                    .padding(.top, 24)
                }
                .padding(.horizontal, 90)
                .padding(.vertical, 60)
            }
            .scrollClipDisabled()
        }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 28) {
            VStack(alignment: .leading, spacing: 10) {
                TVSectionHeader(title: store.editionEyebrow)
                Text(Greeting.text(name: name))
                    .font(.polychatDisplay(.largeTitle))
                    .foregroundStyle(Color.polychat.text)
            }
            Spacer()
            PolyMark(size: 88)
        }
    }

    @ViewBuilder
    private func editionContent(_ edition: DiscoverEdition) -> some View {
        if !edition.brief.isEmpty {
            TVBriefPanel(lines: edition.brief)
        }

        if !store.visibleMedia.isEmpty {
            shelf("Watch and listen") {
                ForEach(store.visibleMedia) { item in
                    NavigationLink(value: TVRoute(item: item)) {
                        TVMediaTile(item: item, state: store.media[item], image: store.mediaArt[item])
                    }
                    .buttonStyle(.card)
                }
            }
        }

        let topics = store.cards(in: .topics)
        if !topics.isEmpty {
            shelf(DiscoverSection.topics.title) {
                ForEach(topics) { card in
                    NavigationLink(value: TVRoute.card(card.id)) {
                        TVTopicTile(card: card, cover: card.coverId.flatMap { store.covers[$0] })
                    }
                    .buttonStyle(.card)
                }
            }
        }

        ForEach(DiscoverSection.allCases.filter { $0 != .topics }, id: \.self) { section in
            let cards = store.cards(in: section)
            if !cards.isEmpty {
                shelf(section.title) {
                    ForEach(cards) { card in
                        NavigationLink(value: TVRoute.card(card.id)) {
                            TVRowCard(card: card)
                        }
                        .buttonStyle(.card)
                    }
                }
            }
        }

        if let interests = edition.interests, !interests.isEmpty {
            Text("Built around \(interests.map(\.topic).joined(separator: " · "))")
                .font(.callout)
                .foregroundStyle(Color.polychat.textMuted)
        }
    }

    private func shelf<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 24) {
            TVSectionHeader(title: title)
            ScrollView(.horizontal) {
                LazyHStack(alignment: .top, spacing: 48) {
                    content()
                }
                .padding(.vertical, 24)
            }
            .scrollClipDisabled()
        }
        .focusSection()
    }

    private func notice(title: String, message: String, actionTitle: String?, action: @escaping () -> Void) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            Text(title)
                .font(.polychatDisplay(.title2))
            Text(message)
                .font(.title3)
                .foregroundStyle(Color.polychat.textMuted)
                .frame(maxWidth: 1100, alignment: .leading)
            if let actionTitle {
                Button(actionTitle, action: action)
            } else {
                ProgressView()
            }
        }
        .padding(48)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.polychat.surface.opacity(0.85), in: RoundedRectangle(cornerRadius: 32, style: .continuous))
    }
}
