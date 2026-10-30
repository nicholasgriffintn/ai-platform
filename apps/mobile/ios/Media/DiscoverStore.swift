import Foundation
import UIKit

@MainActor
final class DiscoverStore: ObservableObject {
    @Published private(set) var discover: DiscoverResponse?
    @Published private(set) var viewedEdition: DiscoverEdition?
    @Published private(set) var covers: [String: UIImage] = [:]
    @Published private(set) var isLoading = false
    @Published private(set) var isWriting = false
    @Published private(set) var media: [DiscoverMediaItem: DiscoverMediaState] = [:]
    @Published private(set) var mediaArt: [DiscoverMediaItem: UIImage] = [:]
    @Published private(set) var credentialRejected = false
    @Published var error: String?

    private var artCache: [String: UIImage] = [:]

    private let apiClient: APIClient
    private let onEdition: (DiscoverEdition?) -> Void
    private static let coverPixelSize: CGFloat = 768
    private static let artPixelSize: CGFloat = 1920
    private static let imageConcurrency = 4

    init(apiClient: APIClient = .shared, onEdition: @escaping (DiscoverEdition?) -> Void = { _ in }) {
        self.apiClient = apiClient
        self.onEdition = onEdition
    }

    func loadIfNeeded() async {
        guard discover == nil, !isLoading else { return }
        await refresh()
    }

    func refresh() async {
        isLoading = true
        defer { isLoading = false }

        do {
            discover = try await apiClient.fetchDiscover()
            onEdition(discover?.edition)
            if discover?.edition != nil {
                isWriting = false
            }
            if let viewed = viewedEdition, let summary = discover?.editions.first(where: { $0.id == viewed.id }) {
                viewedEdition = try await apiClient.fetchDiscoverEdition(date: summary.date, edition: summary.edition)
            } else {
                viewedEdition = nil
            }
            error = nil
            isLoading = false
            await loadImagesAndMedia()
        } catch is CancellationError {
            return
        } catch APIClientError.httpStatus(401, _) {
            credentialRejected = true
        } catch {
            self.error = "Discover could not be reached: \(error.localizedDescription)"
        }
    }

    var edition: DiscoverEdition? {
        viewedEdition ?? discover?.edition
    }

    var isViewingLatest: Bool {
        viewedEdition == nil
    }

    func view(_ summary: DiscoverEditionSummary) async {
        guard summary.id != edition?.id else { return }
        if summary.id == discover?.edition?.id {
            viewedEdition = nil
        } else {
            do {
                viewedEdition = try await apiClient.fetchDiscoverEdition(date: summary.date, edition: summary.edition)
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

        async let episode = fetchEpisode(edition.episodeId)
        async let perch = fetchRecording(.listen, of: edition, present: edition.listenSourceId != nil)
        async let week = fetchRecording(.week, of: edition, present: edition.weekSourceId != nil)
        async let windDown = fetchWindDown(discover.windDownId)

        let loadedEpisode = await episode
        let states: [DiscoverMediaItem: DiscoverMediaState] = [
            .episode: DiscoverMediaPresentation.episode(edition: edition, episode: loadedEpisode),
            .perch: DiscoverMediaPresentation.listen(item: .perch, sourceId: edition.listenSourceId, source: await perch),
            .week: DiscoverMediaPresentation.listen(item: .week, sourceId: edition.weekSourceId, source: await week),
            .windDown: DiscoverMediaPresentation.windDown(await windDown)
        ]
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
            artCache.merge(loaded) { _, new in new }
        }
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
        discover = nil
        viewedEdition = nil
        media = [:]
        mediaArt = [:]
        covers = [:]
        artCache = [:]
        isWriting = false
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
        guard let edition else { return }

        do {
            let response = try await apiClient.sendDiscoverFeedback(
                DiscoverFeedbackRequest(editionId: edition.id, cardId: card.id, signal: signal)
            )
            updateEdition { $0.feedback[response.cardId] = response.signals }
        } catch {
            self.error = "That feedback did not save: \(error.localizedDescription)"
        }
    }

    func signals(for card: DiscoverCard) -> [String] {
        edition?.feedback[card.id] ?? []
    }

    func cards(in section: DiscoverSection) -> [DiscoverCard] {
        (edition?.cards ?? []).filter { $0.section == section && !signals(for: $0).contains("hide") }
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

    private func loadCovers() async {
        let missing = Set((edition?.cards ?? []).compactMap(\.coverId)).subtracting(covers.keys)
        guard !missing.isEmpty else { return }

        let loaded = await ImageDownsampling.images(
            for: Array(missing),
            maxPixelSize: Self.coverPixelSize,
            concurrency: Self.imageConcurrency
        ) { [apiClient] coverId in
            try? await apiClient.fetchDiscoverCover(coverId: coverId)
        }
        covers.merge(loaded) { _, new in new }
    }
}
