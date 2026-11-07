import Foundation
import UIKit

@MainActor
final class DiscoverStore: ObservableObject {
    @Published private(set) var discover: DiscoverResponse?
    @Published private(set) var viewedEdition: DiscoverEdition?
    @Published private(set) var covers: [String: UIImage] = [:]
    @Published private(set) var storyImages: [String: UIImage] = [:]
    @Published private(set) var isLoading = false
    @Published private(set) var isWriting = false
    @Published private(set) var media: [DiscoverMediaItem: DiscoverMediaState] = [:]
    @Published private(set) var mediaArt: [DiscoverMediaItem: UIImage] = [:]
    @Published private(set) var credentialRejected = false
    @Published var error: String?
    @Published private(set) var selectedBriefingId: String?
    @Published private(set) var laterFeedItems: [DiscoverFeedItem] = []
    @Published private(set) var nextFeedCursor: String?
    @Published private(set) var isLoadingMore = false
    private var pendingSeen = Set<String>()
    private var currentRefreshRequestedAt: Date?

    private var artCache: [String: UIImage] = [:]
    private var requestedStoryImages = Set<String>()

    private let apiClient: APIClient
    private let onEdition: (DiscoverEdition?) -> Void
    private let onDiscover: (DiscoverResponse?) -> Void
    private var session = 0
    private var mediaRequest = 0
    private static let coverPixelSize: CGFloat = 768
    private static let artPixelSize: CGFloat = 1920
    private static let imageConcurrency = 4

    init(apiClient: APIClient = .shared, onEdition: @escaping (DiscoverEdition?) -> Void = { _ in }, onDiscover: @escaping (DiscoverResponse?) -> Void = { _ in }) {
        self.apiClient = apiClient
        self.onEdition = onEdition
        self.onDiscover = onDiscover
    }

    func loadIfNeeded() async {
        guard discover == nil, !isLoading else { return }
        await refresh()
    }

    func refresh() async {
        let session = self.session
        isLoading = true
        defer { isLoading = false }

        do {
            let updated = try await apiClient.fetchDiscover()
            guard session == self.session else { return }
            if updated.feed?.updatedAt != discover?.feed?.updatedAt || discover == nil {
                laterFeedItems = []
                nextFeedCursor = updated.feed?.nextCursor
            }
            discover = updated
            onEdition(discover?.edition)
            onDiscover(discover)
            await requestCurrentRefreshIfNeeded(updated)
            guard session == self.session else { return }
            if discover?.edition != nil {
                isWriting = false
            }
            if let viewed = viewedEdition, let summary = discover?.editions.first(where: { $0.id == viewed.id }) {
                let fetched = try await apiClient.fetchDiscoverEdition(date: summary.date, edition: summary.edition)
                guard session == self.session else { return }
                viewedEdition = fetched
            } else {
                viewedEdition = nil
            }
            error = nil
            isLoading = false
            await loadImagesAndMedia()
        } catch let error where error.isCancellation {
            return
        } catch _ where session != self.session {
            return
        } catch APIClientError.httpStatus(401, _) {
            credentialRejected = true
        } catch {
            self.error = "Discover could not be reached: \(error.localizedDescription)"
        }
    }

    var edition: DiscoverEdition? {
        if let viewedEdition { return viewedEdition }
        guard var edition = discover?.edition ?? DiscoverLivePresentation.edition(items: feedItems, reference: nil, now: discover?.now) else { return nil }
        let release = discover?.briefings?.first { $0.id == selectedBriefingId } ?? discover?.briefings?.first { $0.date == discover?.now?.context.date && $0.sourceId != nil && $0.status != "failed" }
        edition.listenSourceId = release?.sourceId ?? edition.listenSourceId
        return edition
    }

    var currentBrief: [DiscoverBriefLine] {
        if let viewedEdition { return viewedEdition.brief }
        return DiscoverLivePresentation.brief(discover: discover)
    }

    func selectBriefing(_ id: String?) async {
        selectedBriefingId = id
        await loadMedia()
    }

    var feedItems: [DiscoverFeedItem] {
        DiscoverLivePresentation.merge(discover?.feed?.items ?? [], laterFeedItems)
    }

    var cardEdition: DiscoverEdition? {
        guard isViewingLatest, discover?.feed != nil else { return edition }
        return DiscoverLivePresentation.edition(items: feedItems, reference: edition, now: discover?.now, mutedTopics: discover?.dayProfile?.mutedTopics ?? [], feedUpdatedAt: discover?.feed?.updatedAt) ?? edition
    }

    func edition(for item: DiscoverItem) -> DiscoverEdition? {
        guard let card = item.card else { return edition }
        return feedItems.contains { $0.card.id == card.id } ? cardEdition : edition
    }

    func loadMore() async {
        guard let cursor = nextFeedCursor, !isLoadingMore else { return }
        let session = self.session
        isLoadingMore = true
        let version = discover?.feed?.updatedAt
        defer { isLoadingMore = false }
        do {
            let page = try await apiClient.fetchDiscoverFeed(before: cursor)
            guard session == self.session, version == discover?.feed?.updatedAt else { return }
            laterFeedItems = DiscoverLivePresentation.merge(laterFeedItems, page.items)
            nextFeedCursor = page.nextCursor
            await loadCovers()
        } catch { self.error = "More stories could not be loaded: \(error.localizedDescription)" }
    }

    func markSeen(_ item: DiscoverFeedItem) async {
        let key = "\(item.id):\(item.revision)"
        guard !item.seen, pendingSeen.insert(key).inserted else { return }
        defer { pendingSeen.remove(key) }
        do {
            _ = try await apiClient.markDiscoverSeen(DiscoverSeenRequest(items: [.init(id: item.id, revision: item.revision)]))
            if let index = discover?.feed?.items.firstIndex(where: { $0.id == item.id && $0.revision == item.revision }) {
                discover?.feed?.items[index].seen = true
            }
            if let index = laterFeedItems.firstIndex(where: { $0.id == item.id && $0.revision == item.revision }) { laterFeedItems[index].seen = true }
        } catch { return }
    }

    func dismiss(_ item: DiscoverFeedItem) async {
        do {
            _ = try await apiClient.dismissDiscoverItem(item.id)
            discover?.feed?.items.removeAll { $0.id == item.id }
            laterFeedItems.removeAll { $0.id == item.id }
        } catch { self.error = "That story could not be dismissed: \(error.localizedDescription)" }
    }

    func refreshCurrent() async {
        do { _ = try await apiClient.refreshDiscoverCurrent(); await refresh() }
        catch { self.error = "Current updates could not be checked: \(error.localizedDescription)" }
    }

    private func requestCurrentRefreshIfNeeded(_ response: DiscoverResponse) async {
        guard response.settings.enabled,
              let deadline = response.now.flatMap({ AppDateParser.parse($0.nextRefreshAt) }),
              deadline <= Date() else { return }
        if let requested = currentRefreshRequestedAt, Date().timeIntervalSince(requested) < 5 * 60 { return }
        currentRefreshRequestedAt = Date()
        _ = try? await apiClient.refreshDiscoverCurrent()
    }

    func saveDay(_ request: DiscoverDayRequest) async throws {
        discover?.dayProfile = try await apiClient.updateDiscoverDay(request)
        await refresh()
    }

    func cardForLink(_ id: String) async -> DiscoverCard? {
        while !feedItems.contains(where: { $0.id == id }), let cursor = nextFeedCursor {
            await loadMore()
            if nextFeedCursor == cursor { break }
        }
        return cardEdition?.cards.first { $0.id == id }
    }

    var isViewingLatest: Bool {
        viewedEdition == nil
    }

    func view(_ summary: DiscoverEditionSummary) async {
        guard summary.id != edition?.id else { return }
        let session = self.session
        if summary.id == discover?.edition?.id {
            viewedEdition = nil
        } else {
            do {
                let fetched = try await apiClient.fetchDiscoverEdition(date: summary.date, edition: summary.edition)
                guard session == self.session else { return }
                viewedEdition = fetched
            } catch {
                self.error = "That edition could not be opened: \(error.localizedDescription)"
                return
            }
        }
        await loadImagesAndMedia()
    }

    func follows(_ topic: String) -> DiscoverFollow? {
        discover?.follows.first { $0.topic.caseInsensitiveCompare(topic) == .orderedSame }
    }

    func toggleFollow(_ topic: String) async {
        do {
            if let follow = follows(topic) {
                try await apiClient.unfollowDiscoverTopic(notebookId: follow.notebookId)
                discover?.follows.removeAll { $0.notebookId == follow.notebookId }
            } else {
                let follow = try await apiClient.followDiscoverTopic(topic)
                discover?.follows.append(follow)
            }
        } catch {
            self.error = "That follow did not save: \(error.localizedDescription)"
        }
    }

    var visibleMedia: [DiscoverMediaItem] {
        guard let discover, let edition else { return [] }
        return DiscoverMediaItem.allCases.filter { item in
            switch item {
            case .episode: return discover.settings.episode != "off" || edition.episodeId != nil
            case .week: return edition.weekSourceId != nil
            case .perch, .windDown: return true
            }
        }
    }

    var items: [DiscoverItem] {
        let cards = (cardEdition?.cards ?? []).filter { !signals(for: $0).contains("hide") }
        return DiscoverItem.ordered(media: visibleMedia, cards: cards)
    }

    var isEveningEdition: Bool {
        edition?.edition == "evening"
    }

    var editionEyebrow: String {
        let summary = edition.flatMap { current in discover?.editions.first { $0.id == current.id } }
        let day = summary?.day ?? Date()
        return (isEveningEdition ? "Evening edition · " : "") + day.formatted(.dateTime.weekday(.wide).day().month(.wide))
    }

    func setPreference(_ request: DiscoverSettingsRequest) async {
        do {
            _ = try await apiClient.updateDiscoverPreferences(request)
            await refresh()
        } catch {
            self.error = "Discover settings did not save: \(error.localizedDescription)"
        }
    }

    func loadMedia() async {
        guard let discover, let edition else {
            media = [:]
            mediaArt = [:]
            return
        }

        let session = self.session
        mediaRequest += 1
        let request = mediaRequest
        async let episode = fetchEpisode(edition.episodeId)
        async let perch = fetchSource(edition.listenSourceId)
        async let week = fetchRecording(.week, of: edition, present: edition.weekSourceId != nil)
        async let windDown = fetchWindDown(discover.windDownId)

        let loadedEpisode = await episode
        let states: [DiscoverMediaItem: DiscoverMediaState] = [
            .episode: DiscoverMediaPresentation.episode(edition: edition, episode: loadedEpisode),
            .perch: DiscoverMediaPresentation.listen(item: .perch, sourceId: edition.listenSourceId, source: await perch),
            .week: DiscoverMediaPresentation.listen(item: .week, sourceId: edition.weekSourceId, source: await week),
            .windDown: DiscoverMediaPresentation.windDown(await windDown)
        ]
        guard session == self.session, request == mediaRequest else { return }
        media = states

        let coverKeys = states.compactMapValues(\.coverKey)
        let missing = Set(coverKeys.values).subtracting(artCache.keys)
        if !missing.isEmpty {
            let loaded = await ImageDownsampling.images(
                for: Array(missing),
                maxPixelSize: Self.artPixelSize,
                concurrency: Self.imageConcurrency
            ) { [apiClient] key in
                await Self.fetchArt(key: key, episode: loadedEpisode, apiClient: apiClient)
            }
            guard session == self.session else { return }
            artCache.merge(loaded) { _, new in new }
        }
        guard request == mediaRequest else { return }
        mediaArt = coverKeys.compactMapValues { artCache[$0] }
    }

    private func loadImagesAndMedia() async {
        async let coversLoaded: Void = loadCovers()
        async let mediaLoaded: Void = loadMedia()
        _ = await (coversLoaded, mediaLoaded)
    }

    private func fetchEpisode(_ id: String?) async -> DiscoverEpisode? {
        guard let id else { return nil }
        return try? await apiClient.fetchDiscoverEpisode(id: id)
    }

    private func fetchSource(_ id: String?) async -> MediaSource? {
        guard let id else { return nil }
        return try? await apiClient.fetchSource(id: id)
    }

    private func fetchRecording(_ recording: DiscoverRecording, of edition: DiscoverEdition, present: Bool) async -> MediaSource? {
        guard present else { return nil }
        return try? await apiClient.fetchDiscoverRecording(editionId: edition.id, recording: recording)
    }

    private func fetchWindDown(_ id: String?) async -> DiscoverWindDown? {
        guard let id else { return nil }
        return try? await apiClient.fetchDiscoverWindDown(id: id)
    }

    private static func fetchArt(key: String, episode: DiscoverEpisode?, apiClient: APIClient) async -> Data? {
        if key.hasPrefix("source:") {
            return try? await apiClient.fetchSourceCover(id: String(key.dropFirst("source:".count)))
        }
        guard let episode, let shot = DiscoverMediaPresentation.coverShot(in: episode) else {
            return nil
        }
        return try? await apiClient.fetchDiscoverEpisodeShot(
            id: episode.id,
            chapter: shot.chapter,
            scene: shot.scene,
            shot: shot.shot
        )
    }

    func reset() {
        session += 1
        currentRefreshRequestedAt = nil
        discover = nil
        viewedEdition = nil
        media = [:]
        mediaArt = [:]
        covers = [:]
        storyImages = [:]
        requestedStoryImages = []
        artCache = [:]
        isWriting = false
        laterFeedItems = []
        nextFeedCursor = nil
        pendingSeen = []
        selectedBriefingId = nil
        error = nil
    }

    func turnOn() async {
        do {
            _ = try await apiClient.updateDiscoverSettings(enabled: true)
            await writeNow()
        } catch {
            self.error = "Discover could not be turned on: \(error.localizedDescription)"
        }
    }

    func setEnabled(_ enabled: Bool) async {
        do {
            _ = try await apiClient.updateDiscoverSettings(enabled: enabled)
            await refresh()
        } catch {
            self.error = "Discover settings did not save: \(error.localizedDescription)"
        }
    }

    func writeNow() async {
        do {
            let result = try await apiClient.refreshDiscover()
            isWriting = result.status == "queued"
            if let message = Self.refreshMessages[result.status] {
                error = message
            }
            await refresh()
        } catch {
            self.error = "Poly could not start the edition: \(error.localizedDescription)"
        }
    }

    func send(_ signal: String, for card: DiscoverCard) async {
        guard let edition = edition(for: .card(card)) else { return }

        do {
            let response = try await apiClient.sendDiscoverFeedback(
                DiscoverFeedbackRequest(editionId: edition.id, cardId: card.id, signal: signal)
            )
            if isViewingLatest, feedItems.contains(where: { $0.card.id == card.id }) {
                if let index = discover?.feed?.items.firstIndex(where: { $0.id == card.id }) { discover?.feed?.items[index].signals = response.signals }
                if let index = laterFeedItems.firstIndex(where: { $0.id == card.id }) { laterFeedItems[index].signals = response.signals }
            } else { updateEdition { $0.feedback[response.cardId] = response.signals } }
        } catch {
            self.error = "That feedback did not save: \(error.localizedDescription)"
        }
    }

    func signals(for card: DiscoverCard) -> [String] {
        cardEdition?.feedback[card.id] ?? []
    }

    func cards(in section: DiscoverSection) -> [DiscoverCard] {
        (cardEdition?.cards ?? []).filter { $0.section == section && !signals(for: $0).contains("hide") }
    }

    private static let refreshMessages = [
        "blocked": "Discover can't run right now. Check your scheduled tasks on the web.",
        "paused": "Discover is paused. Turn it back on in Settings.",
        "not_enabled": "Turn Discover on first."
    ]

    private func updateEdition(_ change: (inout DiscoverEdition) -> Void) {
        if var viewed = viewedEdition {
            change(&viewed)
            viewedEdition = viewed
        } else if var current = discover?.edition {
            change(&current)
            discover?.edition = current
        }
    }

    func loadStoryImage(for card: DiscoverCard) {
        guard card.imageUrl != nil, requestedStoryImages.insert(card.id).inserted else { return }

        Task {
            do {
                let data = try await apiClient.fetchDiscoverItemImage(id: card.id)
                let image = await ImageDownsampling.image(from: data, maxPixelSize: Self.coverPixelSize)
                if requestedStoryImages.contains(card.id) {
                    storyImages[card.id] = image
                }
            } catch {
                requestedStoryImages.remove(card.id)
            }
        }
    }

    private func loadCovers() async {
        let missing = Set((cardEdition?.cards ?? []).compactMap(\.coverId)).subtracting(covers.keys)
        guard !missing.isEmpty else { return }

        let session = self.session
        let loaded = await ImageDownsampling.images(
            for: Array(missing),
            maxPixelSize: Self.coverPixelSize,
            concurrency: Self.imageConcurrency
        ) { [apiClient] coverId in
            try? await apiClient.fetchDiscoverCover(coverId: coverId)
        }
        guard session == self.session else { return }
        covers.merge(loaded) { _, new in new }
    }
}
