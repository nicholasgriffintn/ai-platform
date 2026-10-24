import AVFoundation
import Combine
import Foundation
import UIKit

@MainActor
final class EpisodePlaybackController: ObservableObject {
    @Published private(set) var episode: DiscoverEpisode?
    @Published private(set) var chapterIndex = 0
    @Published private(set) var shotImage: UIImage?
    @Published private(set) var isLoading = false
    @Published var error: String?

    let player = AudioClipPlayer()
    private let apiClient: APIClient
    private var shotCache: [String: UIImage] = [:]
    private var shotKey: String?
    private var timeObserver: AnyCancellable?

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
        player.onFinish = { [weak self] in
            Task { await self?.advance() }
        }
        timeObserver = player.$currentTime
            .removeDuplicates { Int($0) == Int($1) }
            .sink { [weak self] _ in
                Task { await self?.refreshShot() }
            }
    }

    var chapter: DiscoverEpisode.Chapter? {
        episode.flatMap { $0.chapters.indices.contains(chapterIndex) ? $0.chapters[chapterIndex] : nil }
    }

    var caption: String? {
        guard let chapter else { return nil }
        let position = chapter.shot(at: player.currentTime)
        return chapter.scenes.indices.contains(position.scene) ? chapter.scenes[position.scene].caption : nil
    }

    func load(id: String) async {
        isLoading = true
        defer { isLoading = false }
        do {
            episode = try await apiClient.fetchDiscoverEpisode(id: id)
            error = nil
            await refreshShot()
        } catch {
            self.error = "The episode could not be loaded: \(error.localizedDescription)"
        }
    }

    func play(chapter index: Int) async {
        guard let episode, episode.chapters.indices.contains(index), episode.chapters[index].isReady else {
            return
        }
        chapterIndex = index
        isLoading = true
        defer { isLoading = false }
        do {
            let data = try await apiClient.fetchDiscoverEpisodeAudio(id: episode.id, chapter: index)
            try player.load(data, autoplay: true)
            await refreshShot()
        } catch {
            self.error = "That chapter could not be played: \(error.localizedDescription)"
        }
    }

    func togglePlayback() async {
        if player.duration == 0 {
            await play(chapter: chapterIndex)
        } else {
            player.toggle()
        }
    }

    func refreshShot() async {
        guard let episode, let chapter else { return }
        let position = chapter.shot(at: player.currentTime)
        guard chapter.scenes.indices.contains(position.scene),
              chapter.scenes[position.scene].shots.indices.contains(position.shot),
              chapter.scenes[position.scene].shots[position.shot].image else {
            return
        }

        let key = "\(chapterIndex)-\(position.scene)-\(position.shot)"
        guard key != shotKey else { return }
        shotKey = key

        if let cached = shotCache[key] {
            shotImage = cached
            return
        }

        if let data = try? await apiClient.fetchDiscoverEpisodeShot(
            id: episode.id,
            chapter: chapterIndex,
            scene: position.scene,
            shot: position.shot
        ), let image = UIImage(data: data) {
            shotCache[key] = image
            if shotKey == key {
                shotImage = image
            }
        }
    }

    func stop() {
        player.stop()
    }

    private func advance() async {
        guard let episode else { return }
        let next = chapterIndex + 1
        if episode.chapters.indices.contains(next), episode.chapters[next].isReady {
            await play(chapter: next)
        }
    }
}

@MainActor
final class WindDownPlaybackController: ObservableObject {
    @Published private(set) var windDown: DiscoverWindDown?
    @Published private(set) var stepIndex = 0
    @Published private(set) var isPlaying = false
    @Published private(set) var isWorking = false
    @Published var error: String?

    let player = AudioClipPlayer()
    private let apiClient: APIClient
    private var sequence: Task<Void, Never>?
    private var music: AVAudioPlayer?
    private static let musicVolume: Float = 0.28

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    var currentText: String? {
        windDown.flatMap { $0.steps.indices.contains(stepIndex) ? $0.steps[stepIndex].text : nil }
    }

    func load(id: String) async {
        do {
            windDown = try await apiClient.fetchDiscoverWindDown(id: id)
            error = nil
        } catch {
            self.error = "Wind down could not be loaded: \(error.localizedDescription)"
        }
    }

    func start(kind: String, minutes: Int) async {
        isWorking = true
        defer { isWorking = false }
        do {
            windDown = try await apiClient.startDiscoverWindDown(kind: kind, minutes: minutes)
            error = nil
            await waitUntilReady()
        } catch {
            self.error = "Wind down could not start: \(error.localizedDescription)"
        }
    }

    func waitUntilReady() async {
        while let current = windDown, !current.isReady, current.status != "failed", !Task.isCancelled {
            try? await Task.sleep(for: .seconds(3))
            await load(id: current.id)
        }
    }

    func togglePlayback() {
        if isPlaying {
            sequence?.cancel()
            player.pause()
            music?.pause()
            isPlaying = false
            return
        }

        guard let windDown, windDown.isReady else { return }
        isPlaying = true
        sequence = Task { [weak self] in
            await self?.startMusic(for: windDown)
            await self?.playSteps(windDown, from: self?.stepIndex ?? 0)
        }
    }

    func stop() {
        sequence?.cancel()
        player.stop()
        music?.stop()
        music = nil
        isPlaying = false
    }

    private func startMusic(for windDown: DiscoverWindDown) async {
        if let music {
            music.play()
            return
        }

        guard windDown.ambient == true,
              let data = try? await apiClient.fetchDiscoverWindDownAmbient(id: windDown.id),
              let music = try? AVAudioPlayer(data: data) else {
            return
        }

        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        try? AVAudioSession.sharedInstance().setActive(true)
        music.numberOfLoops = -1
        music.volume = Self.musicVolume
        music.prepareToPlay()
        music.play()
        self.music = music
    }

    private func playSteps(_ windDown: DiscoverWindDown, from start: Int) async {
        for index in start..<windDown.steps.count {
            guard !Task.isCancelled else { return }
            stepIndex = index
            let step = windDown.steps[index]

            if step.audio, let data = try? await apiClient.fetchDiscoverWindDownStepAudio(id: windDown.id, step: index) {
                try? player.load(data, autoplay: true)
                while player.isPlaying, !Task.isCancelled {
                    try? await Task.sleep(for: .milliseconds(200))
                }
            }

            try? await Task.sleep(for: .seconds(step.pauseSeconds))
        }

        if !Task.isCancelled {
            isPlaying = false
            stepIndex = 0
            music?.setVolume(0, fadeDuration: 4)
            try? await Task.sleep(for: .seconds(4))
            music?.stop()
            music = nil
        }
    }
}
