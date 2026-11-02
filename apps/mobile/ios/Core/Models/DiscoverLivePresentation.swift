import Foundation

enum DiscoverLivePresentation {
    static func brief(discover: DiscoverResponse?) -> [DiscoverBriefLine] {
        guard discover?.settings.enabled == true, let observations = discover?.now?.observations, !observations.isEmpty else { return discover?.edition?.brief ?? [] }
        return observations.prefix(4).map {
            DiscoverBriefLine(kind: $0.kind == "priority" ? "waiting" : $0.kind, label: $0.isStale ? "\($0.title) · Last known" : $0.title, text: $0.text, href: $0.href)
        }
    }

    static func edition(items: [DiscoverFeedItem], reference: DiscoverEdition?, now: DiscoverNow?, mutedTopics: [String] = [], feedUpdatedAt: String? = nil) -> DiscoverEdition? {
        guard let id = items.first?.editionId ?? (feedUpdatedAt != nil ? reference?.id : nil) else { return nil }
        let curated = (reference?.cards ?? []).filter { !$0.isLiveFeedCard }
        let muted = Set(mutedTopics.map { $0.lowercased() })
        var feedback = reference?.feedback ?? [:]
        for item in items { feedback[item.card.id] = item.signals }
        return DiscoverEdition(
            id: id,
            date: now?.context.date ?? reference?.date ?? "",
            greeting: now?.title ?? reference?.greeting ?? "Discover",
            interests: reference?.interests,
            brief: [],
            cards: (curated + items.map(\.card)).filter { !muted.contains($0.topic?.lowercased() ?? "") },
            feedback: feedback,
            listenSourceId: reference?.listenSourceId,
            weekSourceId: reference?.weekSourceId,
            edition: reference?.edition,
            episodeId: reference?.episodeId,
            episodeOverBudget: reference?.episodeOverBudget,
            episodeFailed: reference?.episodeFailed
        )
    }

    static func merge(_ first: [DiscoverFeedItem], _ later: [DiscoverFeedItem]) -> [DiscoverFeedItem] {
        var seen = Set<String>()
        return (first + later).filter { seen.insert($0.id).inserted }
    }
}
