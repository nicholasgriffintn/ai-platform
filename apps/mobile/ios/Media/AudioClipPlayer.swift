import AVFoundation
import Foundation

@MainActor
final class AudioClipPlayer: NSObject, ObservableObject, AVAudioPlayerDelegate {
    @Published private(set) var isPlaying = false
    @Published private(set) var currentTime: TimeInterval = 0
    @Published private(set) var duration: TimeInterval = 0

    var onFinish: (() -> Void)?
    var volume: Float = 1 {
        didSet { player?.volume = volume }
    }

    private var player: AVAudioPlayer?
    private var ticker: Task<Void, Never>?

    func load(_ data: Data, autoplay: Bool) async throws {
        stop()
        try await PlaybackSession.activate()
        let player = try AVAudioPlayer(data: data)
        player.delegate = self
        player.volume = volume
        player.prepareToPlay()
        self.player = player
        duration = player.duration
        currentTime = 0
        if autoplay {
            play()
        }
    }

    func play() {
        guard let player else { return }
        player.play()
        isPlaying = true
        startTicking()
    }

    func pause() {
        player?.pause()
        isPlaying = false
        ticker?.cancel()
    }

    func toggle() {
        isPlaying ? pause() : play()
    }

    func seek(to time: TimeInterval) {
        player?.currentTime = max(0, min(time, duration))
        currentTime = player?.currentTime ?? 0
    }

    func stop() {
        ticker?.cancel()
        player?.stop()
        player = nil
        isPlaying = false
        currentTime = 0
        duration = 0
    }

    private func startTicking() {
        ticker?.cancel()
        ticker = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(250))
                guard let self, let player = self.player else { return }
                self.currentTime = player.currentTime
            }
        }
    }

    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in
            self.isPlaying = false
            self.ticker?.cancel()
            self.currentTime = self.duration
            self.onFinish?()
        }
    }
}
