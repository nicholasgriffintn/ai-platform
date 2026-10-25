import Combine
import Foundation

@MainActor
final class DiscoverPlayback: ObservableObject {
    @Published private(set) var current: DiscoverMediaItem?

    let episode = EpisodePlaybackController()
    let windDown = WindDownPlaybackController()
    private var listens: [DiscoverMediaItem: ListenPlaybackController] = [:]
    private var observers: Set<AnyCancellable> = []

    init() {
        ExternalDisplayStage.shared.present(episode)
        observe(episode.player.$isPlaying, as: .episode)
        observe(windDown.$isPlaying, as: .windDown)
    }

    func listen(_ item: DiscoverMediaItem, editionId: String) -> ListenPlaybackController {
        if let existing = listens[item], existing.editionId == editionId {
            return existing
        }
        listens[item]?.stop()
        let controller = ListenPlaybackController(item: item, editionId: editionId)
        listens[item] = controller
        observe(controller.player.$isPlaying, as: item)
        return controller
    }

    var isPlaying: Bool {
        switch current {
        case .episode: return episode.player.isPlaying
        case .windDown: return windDown.isPlaying
        case .perch, .week: return current.flatMap { listens[$0] }?.player.isPlaying ?? false
        case nil: return false
        }
    }

    var currentTitle: String? {
        switch current {
        case .episode: return episode.chapter?.title ?? episode.episode?.title
        case .windDown: return windDown.windDown?.title
        case .perch, .week: return current.flatMap { listens[$0] }?.source?.title
        case nil: return nil
        }
    }

    func toggle() async {
        switch current {
        case .episode: await episode.togglePlayback()
        case .windDown: windDown.togglePlayback()
        case .perch, .week: await current.flatMap { listens[$0] }?.togglePlayback()
        case nil: return
        }
    }

    func stopAll() {
        episode.stop()
        windDown.stop()
        listens.values.forEach { $0.stop() }
        current = nil
    }

    func reset() {
        stopAll()
        windDown.reset()
        listens = [:]
    }

    private func observe(_ playing: Published<Bool>.Publisher, as item: DiscoverMediaItem) {
        playing
            .removeDuplicates()
            .sink { [weak self] isPlaying in
                Task { @MainActor in
                    self?.objectWillChange.send()
                    if isPlaying {
                        self?.claim(item)
                    }
                }
            }
            .store(in: &observers)
    }

    private func claim(_ item: DiscoverMediaItem) {
        if item != .episode { episode.pause() }
        if item != .windDown, windDown.isPlaying { windDown.togglePlayback() }
        for (other, controller) in listens where other != item {
            controller.pause()
        }
        current = item
    }
}
