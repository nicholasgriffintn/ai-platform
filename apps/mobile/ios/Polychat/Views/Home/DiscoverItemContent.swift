import SwiftUI

struct DiscoverItemContent: View {
    @EnvironmentObject private var store: DiscoverStore
    @EnvironmentObject private var playback: DiscoverPlayback
    let item: DiscoverItem
    let edition: DiscoverEdition
    let onOpenLink: (DiscoverCard) -> Void
    let onSelect: (DiscoverCard) -> Void

    var body: some View {
        if item == .media(.windDown) {
            WindDownView(controller: playback.windDown, windDownId: store.discover?.windDownId)
                .safeAreaInset(edge: .bottom) {
                    Label("Chat is tucked away during Wind down", systemImage: "moon.stars")
                        .font(.caption)
                        .foregroundStyle(Color.polychat.textMuted)
                        .padding(.vertical, 10)
                }
        } else if let subject = item.subject(in: edition) {
            DiscoverItemChat(
                subject: subject,
                summary: summary,
                suggestions: item.suggestions,
                placeholder: item.placeholder,
                player: player
            ) {
                lead
            }
        } else {
            ScrollView {
                lead
                    .padding(16)
                    .frame(maxWidth: 760)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    @ViewBuilder
    private var lead: some View {
        switch item {
        case .media(.episode):
            EpisodePlayerView(
                controller: playback.episode,
                edition: edition,
                artwork: store.mediaArt[.episode],
                onRefresh: { await store.refresh() }
            )
        case .media(.perch):
            SourceListenView(
                controller: playback.listen(.perch, editionId: edition.id, sourceId: edition.listenSourceId),
                sourceId: edition.listenSourceId,
                artwork: store.mediaArt[.perch],
                onRefresh: { await store.refresh() }
            )
        case .media(.week):
            SourceListenView(
                controller: playback.listen(.week, editionId: edition.id, sourceId: edition.weekSourceId),
                sourceId: edition.weekSourceId,
                artwork: store.mediaArt[.week],
                onRefresh: { await store.refresh() }
            )
        case .media(.windDown):
            EmptyView()
        case .card(let card):
            DiscoverCardBlock(
                card: card,
                cover: card.coverId.flatMap { store.covers[$0] },
                storyImage: store.storyImages[card.id],
                isFollowing: card.topic.flatMap { store.follows($0) } != nil,
                related: card.relatedReading(in: edition.cards),
                onOpenLink: { onOpenLink(card) },
                onToggleFollow: { topic in Task { await store.toggleFollow(topic) } },
                onSelect: onSelect
            )
            .onAppear { store.loadStoryImage(for: card) }
        }
    }

    private var summary: DiscoverItemSummary {
        switch item {
        case .media(let media):
            return DiscoverItemSummary(
                title: store.media[media]?.title ?? media.title,
                kicker: media.title,
                art: .media(media, store.mediaArt[media])
            )
        case .card(let card):
            return DiscoverItemSummary(
                title: card.headline,
                kicker: card.eyebrow,
                art: .card(card, card.coverId.flatMap { store.covers[$0] } ?? store.storyImages[card.id])
            )
        }
    }

    private var player: DiscoverItemTransport? {
        switch item {
        case .media(.episode):
            let controller = playback.episode
            return DiscoverItemTransport(player: controller.player) { await controller.togglePlayback() }
        case .media(let media) where media == .perch || media == .week:
            let controller = playback.listen(media, editionId: edition.id, sourceId: media == .perch ? edition.listenSourceId : edition.weekSourceId)
            return DiscoverItemTransport(player: controller.player) { await controller.togglePlayback() }
        default:
            return nil
        }
    }
}
