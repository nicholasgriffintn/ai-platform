import Foundation
import UIKit

@MainActor
final class DiscoverStore: ObservableObject {
    @Published private(set) var discover: DiscoverResponse?
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

    init(apiClient: APIClient = .shared, onEdition: @escaping (DiscoverEdition?) -> Void = { _ in }) {
        self.apiClient = apiClient
        self.onEdition = onEdition
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
            error = nil
            await loadCovers()
            await loadMedia()
        } catch is CancellationError {
            return
        } catch APIClientError.httpStatus(401, _) {
            credentialRejected = true
        } catch {
            self.error = "Discover could not be reached: \(error.localizedDescription)"
        }
    }

    var visibleMedia: [DiscoverMediaItem] {
        guard let discover, let edition = discover.edition else { return [] }
        return DiscoverMediaItem.allCases.filter { item in
            switch item {
            case .episode: return discover.settings.episode != "off" || edition.episodeId != nil
            case .week: return edition.weekSourceId != nil
            case .perch, .windDown: return true
            }
        }
    }

    var isEveningEdition: Bool {
        discover?.edition?.edition == "evening"
    }

    var editionEyebrow: String {
        (isEveningEdition ? "Evening edition · " : "") + Date().formatted(.dateTime.weekday(.wide).day().month(.wide))
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
        guard let discover, let edition = discover.edition else {
            media = [:]
            mediaArt = [:]
            return
        }

        async let episode = fetchEpisode(edition.episodeId)
        async let perch = fetchRecording(.listen, of: edition, present: edition.listenSourceId != nil)
        async let week = fetchRecording(.week, of: edition, present: edition.weekSourceId != nil)
        async let windDown = fetchWindDown(discover.windDownId)

        let loadedEpisode = await episode
        media = [
            .episode: DiscoverMediaPresentation.episode(edition: edition, episode: loadedEpisode),
            .perch: DiscoverMediaPresentation.listen(item: .perch, sourceId: edition.listenSourceId, source: await perch),
            .week: DiscoverMediaPresentation.listen(item: .week, sourceId: edition.weekSourceId, source: await week),
            .windDown: DiscoverMediaPresentation.windDown(await windDown)
        ]

        for (item, state) in media {
            guard let key = state.coverKey else {
                mediaArt[item] = nil
                continue
            }
            if let cached = artCache[key] {
                mediaArt[item] = cached
            } else if let image = await loadArt(key: key, episode: loadedEpisode) {
                artCache[key] = image
                mediaArt[item] = image
            }
        }
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

    private func loadArt(key: String, episode: DiscoverEpisode?) async -> UIImage? {
        let data: Data?
        if key.hasPrefix("source:") {
            data = try? await apiClient.fetchSourceCover(id: String(key.dropFirst("source:".count)))
        } else if let episode, let shot = DiscoverMediaPresentation.coverShot(in: episode) {
            data = try? await apiClient.fetchDiscoverEpisodeShot(
                id: episode.id,
                chapter: shot.chapter,
                scene: shot.scene,
                shot: shot.shot
            )
        } else {
            data = nil
        }
        return data.flatMap(UIImage.init(data:))
    }

    func reset() {
        discover = nil
        media = [:]
        mediaArt = [:]
        covers = [:]
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
        guard let edition = discover?.edition else { return }

        do {
            _ = try await apiClient.sendDiscoverFeedback(
                DiscoverFeedbackRequest(editionId: edition.id, cardId: card.id, signal: signal)
            )
            await refresh()
        } catch {
            self.error = "That feedback did not save: \(error.localizedDescription)"
        }
    }

    func signals(for card: DiscoverCard) -> [String] {
        discover?.edition?.feedback[card.id] ?? []
    }

    func cards(in section: DiscoverSection) -> [DiscoverCard] {
        (discover?.edition?.cards ?? []).filter { $0.section == section && !signals(for: $0).contains("hide") }
    }

    private static let refreshMessages = [
        "blocked": "Discover can't run right now. Check your scheduled tasks on the web.",
        "paused": "Discover is paused. Turn it back on in Settings.",
        "not_enabled": "Turn Discover on first."
    ]

    private func loadCovers() async {
        let coverIds = (discover?.edition?.cards ?? []).compactMap(\.coverId)

        for coverId in coverIds where covers[coverId] == nil {
            if let data = try? await apiClient.fetchDiscoverCover(coverId: coverId),
               let image = UIImage(data: data) {
                covers[coverId] = image
            }
        }
    }
}
