import AVFoundation
import Foundation

@MainActor
final class CrossfadeLooper {
    private static let crossfade: TimeInterval = 8
    private static let fade: TimeInterval = 2
    private static let levelFade: TimeInterval = 0.3

    private let players: [AVAudioPlayer]
    private var current: AVAudioPlayer?
    private var cycle: Task<Void, Never>?
    private var pausing: Task<Void, Never>?
    private var volume: Float

    init?(data: Data, volume: Float) {
        guard let first = try? AVAudioPlayer(data: data),
              let second = try? AVAudioPlayer(data: data) else {
            return nil
        }
        players = [first, second]
        self.volume = volume
        players.forEach { $0.prepareToPlay() }
    }

    private var crossfade: TimeInterval {
        min(Self.crossfade, (players.first?.duration ?? 0) / 3)
    }

    func play() {
        guard cycle == nil else { return }
        pausing?.cancel()
        pausing = nil

        if let current {
            current.play()
            current.setVolume(volume, fadeDuration: Self.fade)
        } else if let first = players.first {
            first.currentTime = 0
            first.volume = 0
            first.play()
            first.setVolume(volume, fadeDuration: crossfade)
            current = first
        }

        cycle = Task { [weak self] in await self?.loop() }
    }

    func pause() {
        cycle?.cancel()
        cycle = nil
        let sounding = players.filter(\.isPlaying)
        sounding.forEach { $0.setVolume(0, fadeDuration: Self.fade) }
        pausing = Task {
            try? await Task.sleep(for: .seconds(Self.fade))
            guard !Task.isCancelled else { return }
            sounding.forEach { $0.pause() }
        }
    }

    func setVolume(_ volume: Float) {
        self.volume = volume
        current?.setVolume(volume, fadeDuration: Self.levelFade)
    }

    func fadeOut(over seconds: TimeInterval) {
        cycle?.cancel()
        cycle = nil
        players.forEach { $0.setVolume(0, fadeDuration: seconds) }
    }

    func stop() {
        cycle?.cancel()
        pausing?.cancel()
        cycle = nil
        players.forEach { $0.stop() }
        current = nil
    }

    private func loop() async {
        while !Task.isCancelled, let playing = current {
            let wait = playing.duration - playing.currentTime - crossfade
            if wait > 0 {
                try? await Task.sleep(for: .seconds(wait))
                guard !Task.isCancelled else { return }
            }

            guard let next = players.first(where: { $0 !== playing }) else { return }
            next.currentTime = 0
            next.volume = 0
            next.play()
            next.setVolume(volume, fadeDuration: crossfade)
            playing.setVolume(0, fadeDuration: crossfade)
            current = next

            let fadeSeconds = crossfade
            Task {
                try? await Task.sleep(for: .seconds(fadeSeconds))
                if playing !== self.current { playing.stop() }
            }
        }
    }
}
