import Foundation

@MainActor
final class ExternalDisplayStage: ObservableObject {
    static let shared = ExternalDisplayStage()

    @Published private(set) var episode: EpisodePlaybackController?

    func present(_ controller: EpisodePlaybackController) {
        episode = controller
    }

    func dismiss(_ controller: EpisodePlaybackController) {
        if episode === controller {
            episode = nil
        }
    }
}
