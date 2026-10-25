import TVServices
import UIKit

@MainActor
enum TopShelfPublisher {
    private static let cardLimit = 6

    static func publish(from store: DiscoverStore) {
        guard let edition = store.discover?.edition else {
            TopShelfStore.clear()
            TVTopShelfContentProvider.topShelfContentDidChange()
            return
        }

        var items: [TopShelfSnapshot.Item] = []

        if edition.episodeId != nil, let state = store.media[.episode] {
            items.append(TopShelfSnapshot.Item(
                id: "episode",
                title: state.title,
                imageFile: store.mediaArt[.episode].flatMap { save($0, named: "episode") },
                link: TVRoute.episode.url.absoluteString
            ))
        }

        for card in edition.cards.prefix(cardLimit) where !store.signals(for: card).contains("hide") {
            items.append(TopShelfSnapshot.Item(
                id: card.id,
                title: card.headline,
                imageFile: card.coverId.flatMap { store.covers[$0] }.flatMap { save($0, named: card.id) },
                link: TVRoute.card(card.id).url.absoluteString
            ))
        }

        TopShelfStore.write(TopShelfSnapshot(items: items))
        TVTopShelfContentProvider.topShelfContentDidChange()
    }

    private static func save(_ image: UIImage, named name: String) -> String? {
        image.jpegData(compressionQuality: 0.8).flatMap { TopShelfStore.saveImage($0, named: name) }
    }
}
