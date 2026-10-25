import TVServices

final class ContentProvider: TVTopShelfContentProvider {
    override func loadTopShelfContent() async -> TVTopShelfContent? {
        let items = TopShelfStore.read().items.compactMap(Self.item)
        guard !items.isEmpty else { return nil }

        let section = TVTopShelfItemCollection(items: items)
        section.title = "Today in Discover"
        return TVTopShelfSectionedContent(sections: [section])
    }

    private static func item(_ entry: TopShelfSnapshot.Item) -> TVTopShelfSectionedItem? {
        guard let url = URL(string: entry.link) else { return nil }
        let item = TVTopShelfSectionedItem(identifier: entry.id)
        item.title = entry.title
        item.imageShape = .hdtv
        item.displayAction = TVTopShelfAction(url: url)
        item.playAction = TVTopShelfAction(url: url)
        if let file = entry.imageFile, let imageURL = TopShelfStore.imageURL(for: file) {
            item.setImageURL(imageURL, for: [.screenScale1x, .screenScale2x])
        }
        return item
    }
}
