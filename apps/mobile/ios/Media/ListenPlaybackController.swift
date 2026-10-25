import Foundation
import UIKit

@MainActor
final class ListenPlaybackController: ObservableObject {
    @Published private(set) var source: MediaSource?
    @Published private(set) var isWorking = false
    @Published private(set) var requested = false
    @Published var error: String?

    let player = AudioClipPlayer()
    let item: DiscoverMediaItem
    let editionId: String
    private let apiClient: APIClient
    private var artwork: UIImage?

    init(item: DiscoverMediaItem, editionId: String, apiClient: APIClient = .shared) {
        self.item = item
        self.editionId = editionId
        self.apiClient = apiClient
    }

    var recording: DiscoverRecording {
        item.recording ?? .listen
    }

    func follow(hasRecording: Bool, artwork: UIImage?) async {
        self.artwork = artwork
        while hasRecording || requested, !Task.isCancelled {
            source = try? await apiClient.fetchDiscoverRecording(editionId: editionId, recording: recording)
            if source?.isPlayable == true || source?.status == "failed" {
                return
            }
            try? await Task.sleep(for: .seconds(5))
        }
    }

    func togglePlayback() async {
        guard player.duration == 0 else {
            player.toggle()
            publishNowPlaying()
            return
        }

        isWorking = true
        defer { isWorking = false }
        do {
            let data = try await apiClient.fetchDiscoverRecordingAudio(editionId: editionId, recording: recording)
            try await player.load(data, autoplay: true)
            NowPlayingCenter.shared.bind(
                isPlaying: { [weak self] in self?.player.isPlaying ?? false },
                setPlaying: { [weak self] playing in
                    guard let self, playing != self.player.isPlaying else { return }
                    Task { await self.togglePlayback() }
                }
            )
            publishNowPlaying()
        } catch {
            self.error = "This recording could not be played: \(error.localizedDescription)"
        }
    }

    func record(onRefresh: () async -> Void) async {
        isWorking = true
        defer { isWorking = false }
        do {
            if item == .week {
                try await apiClient.requestDiscoverWeek(editionId: editionId)
            } else {
                _ = try await apiClient.requestDiscoverListen(editionId: editionId)
            }
            requested = true
            error = nil
            await onRefresh()
        } catch {
            self.error = "The recording could not be started: \(error.localizedDescription)"
        }
    }

    func pause() {
        guard player.isPlaying else { return }
        player.pause()
        publishNowPlaying()
    }

    func stop() {
        player.stop()
        NowPlayingCenter.shared.clear()
    }

    private func publishNowPlaying() {
        guard let source else { return }
        NowPlayingCenter.shared.update(NowPlayingCenter.Item(
            title: source.title,
            subtitle: item.title,
            artwork: artwork,
            duration: player.duration,
            elapsed: player.currentTime,
            isPlaying: player.isPlaying
        ))
    }
}
