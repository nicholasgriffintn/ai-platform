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
    private var pendingSeek: Double?
    private var reportedMark: String?
    private var observers: Set<AnyCancellable> = []
    private static let resumeIntervalSeconds = 15.0
    private static let shotPixelSize: CGFloat = 1920

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
        player.onFinish = { [weak self] in
            Task { await self?.advance() }
        }
        player.$currentTime
            .removeDuplicates { Int($0) == Int($1) }
            .sink { [weak self] _ in
                Task { @MainActor in
                    await self?.refreshShot()
                    self?.reportProgress()
                }
            }
            .store(in: &observers)
        player.$isPlaying
            .removeDuplicates()
            .sink { [weak self] _ in
                Task { @MainActor in self?.reportProgress() }
            }
            .store(in: &observers)
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
            let loaded = try await apiClient.fetchDiscoverEpisode(id: id)
            if episode?.id != loaded.id {
                applyResume(loaded)
            }
            episode = loaded
            error = nil
            await refreshShot()
        } catch {
            self.error = "The episode could not be loaded: \(error.localizedDescription)"
        }
    }

    func follow(id: String) async {
        await load(id: id)
        while !Task.isCancelled, let current = episode, current.chapters.contains(where: { !$0.isReady && $0.status != "failed" }) {
            try? await Task.sleep(for: .seconds(10))
            if let refreshed = try? await apiClient.fetchDiscoverEpisode(id: id) {
                episode = refreshed
            }
        }
    }

    private func playChapter(_ index: Int) async {
        guard let episode, episode.chapters.indices.contains(index), episode.chapters[index].isReady else {
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            let data = try await apiClient.fetchDiscoverEpisodeAudio(id: episode.id, chapter: index)
            reportProgress()
            try await player.load(data, autoplay: false)
            chapterIndex = index
            if let pendingSeek {
                player.seek(to: pendingSeek)
                self.pendingSeek = nil
            }
            player.play()
            bindNowPlaying()
            await refreshShot()
            publishNowPlaying()
        } catch {
            self.error = "That chapter could not be played: \(error.localizedDescription)"
        }
    }

    func play(chapter index: Int, fromStart: Bool) async {
        if fromStart {
            pendingSeek = nil
        }
        await playChapter(index)
    }

    func togglePlayback() async {
        if player.duration == 0 {
            await playChapter(chapterIndex)
        } else {
            player.toggle()
            publishNowPlaying()
        }
    }

    func setPlaying(_ playing: Bool) async {
        guard playing != player.isPlaying else { return }
        await togglePlayback()
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
            publishNowPlaying()
            return
        }

        let data = try? await apiClient.fetchDiscoverEpisodeShot(
            id: episode.id,
            chapter: chapterIndex,
            scene: position.scene,
            shot: position.shot
        )
        if let image = await ImageDownsampling.image(from: data, maxPixelSize: Self.shotPixelSize) {
            shotCache[key] = image
            if shotKey == key {
                shotImage = image
                publishNowPlaying()
            }
        }
    }

    func pause() {
        guard player.isPlaying else { return }
        player.pause()
        publishNowPlaying()
    }

    func stop() {
        reportProgress()
        player.stop()
        NowPlayingCenter.shared.clear()
    }

    private func applyResume(_ episode: DiscoverEpisode) {
        guard player.duration == 0,
              let resume = episode.progress?.resume,
              episode.chapters.indices.contains(resume.chapter) else {
            return
        }
        chapterIndex = resume.chapter
        pendingSeek = resume.seconds
    }

    private func reportProgress() {
        guard let episode, player.currentTime > 0 else { return }
        let mark = player.isPlaying
            ? "\(chapterIndex):\(Int(player.currentTime / Self.resumeIntervalSeconds))"
            : "\(chapterIndex):paused:\(Int(player.currentTime))"
        guard mark != reportedMark else { return }
        reportedMark = mark
        let request = DiscoverEpisodeProgressRequest(
            fraction: episode.watchedFraction(chapter: chapterIndex, seconds: player.currentTime),
            resume: DiscoverEpisode.Resume(chapter: chapterIndex, seconds: player.currentTime)
        )
        Task { [apiClient] in
            try? await apiClient.recordDiscoverEpisodeProgress(id: episode.id, request)
        }
    }

    private var nextChapter: Int? {
        guard let episode else { return nil }
        let next = chapterIndex + 1
        return episode.chapters.indices.contains(next) && episode.chapters[next].isReady ? next : nil
    }

    private func advance() async {
        if let next = nextChapter {
            await play(chapter: next, fromStart: true)
        } else {
            publishNowPlaying()
        }
    }

    private func bindNowPlaying() {
        NowPlayingCenter.shared.bind(
            isPlaying: { [weak self] in self?.player.isPlaying ?? false },
            setPlaying: { [weak self] playing in Task { await self?.setPlaying(playing) } },
            onNext: { [weak self] in
                Task {
                    guard let self, let next = self.nextChapter else { return }
                    await self.play(chapter: next, fromStart: true)
                }
            }
        )
    }

    private func publishNowPlaying() {
        guard let episode, let chapter else { return }
        NowPlayingCenter.shared.update(NowPlayingCenter.Item(
            title: chapter.title,
            subtitle: episode.title,
            artwork: shotImage,
            duration: player.duration,
            elapsed: player.currentTime,
            isPlaying: player.isPlaying
        ))
    }
}

@MainActor
final class WindDownPlaybackController: ObservableObject {
    @Published private(set) var windDown: DiscoverWindDown?
    @Published private(set) var tonight: DiscoverWindDownTonight?
    @Published private(set) var stepIndex = 0
    @Published private(set) var soundElapsed = 0
    @Published private(set) var isPlaying = false
    @Published private(set) var isWorking = false
    @Published var error: String?
    @Published var balance: Double {
        didSet {
            defaults.set(balance, forKey: Self.balanceKey)
            applyLevels()
        }
    }
    @Published var afterVoiceMinutes: Int {
        didSet { defaults.set(afterVoiceMinutes, forKey: Self.afterVoiceKey) }
    }

    let player = AudioClipPlayer()
    private let apiClient: APIClient
    private let defaults: UserDefaults
    private var sequence: Task<Void, Never>?
    private var music: CrossfadeLooper?
    private static let musicVolume: Float = 0.35
    private static let tailFadeSeconds = 45
    private static let endFadeSeconds = 4
    private static let balanceKey = "windDown.balance"
    private static let afterVoiceKey = "windDown.afterVoiceMinutes"

    init(apiClient: APIClient = .shared, defaults: UserDefaults = .standard) {
        self.apiClient = apiClient
        self.defaults = defaults
        balance = defaults.object(forKey: Self.balanceKey) as? Double ?? 0.5
        afterVoiceMinutes = defaults.integer(forKey: Self.afterVoiceKey)
        player.volume = Self.levels(balance: balance).voice
    }

    static func levels(balance: Double) -> (voice: Float, sound: Float) {
        let clamped = min(1, max(0, balance))
        return (Float(min(1, 2 * clamped)), Float(min(1, 2 * (1 - clamped))))
    }

    var currentText: String? {
        windDown.flatMap { $0.steps.indices.contains(stepIndex) ? $0.steps[stepIndex].text : nil }
    }

    var progress: Double {
        guard let windDown else { return 0 }
        if windDown.isSoundOnly {
            return Double(soundElapsed) / Double(max(1, windDown.minutes * 60))
        }
        return Double(stepIndex) / Double(max(1, windDown.steps.count))
    }

    func load(id: String) async {
        do {
            windDown = try await apiClient.fetchDiscoverWindDown(id: id)
            error = nil
        } catch {
            self.error = "Wind down could not be loaded: \(error.localizedDescription)"
        }
    }

    func loadTonight() async {
        tonight = try? await apiClient.fetchDiscoverWindDownTonight()
    }

    func start(_ request: DiscoverWindDownRequest) async {
        stop()
        stepIndex = 0
        soundElapsed = 0
        isWorking = true
        defer { isWorking = false }
        do {
            windDown = try await apiClient.startDiscoverWindDown(request)
            error = nil
            await waitUntilReady()
        } catch {
            self.error = "Wind down could not start: \(error.localizedDescription)"
        }
    }

    func startStory(editionId: String, cardId: String) async -> String? {
        isWorking = true
        defer { isWorking = false }
        do {
            let story = try await apiClient.startDiscoverStory(editionId: editionId, cardId: cardId)
            if windDown?.id != story.id {
                stop()
                stepIndex = 0
                soundElapsed = 0
                windDown = story
            }
            error = nil
            return story.id
        } catch {
            self.error = "Tonight's story could not start: \(error.localizedDescription)"
            return nil
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
            publishNowPlaying()
            return
        }

        guard let windDown, windDown.isReady else { return }
        sequence?.cancel()
        isPlaying = true
        NowPlayingCenter.shared.bind(
            isPlaying: { [weak self] in self?.isPlaying ?? false },
            setPlaying: { [weak self] playing in
                guard let self, playing != self.isPlaying else { return }
                self.togglePlayback()
            }
        )
        publishNowPlaying()
        sequence = Task { [weak self] in
            guard let self else { return }
            do {
                try await PlaybackSession.activate()
            } catch {
                self.error = "Wind down could not play: \(error.localizedDescription)"
                self.isPlaying = false
                self.publishNowPlaying()
                return
            }
            await self.startMusic(for: windDown)
            await self.play(windDown)
        }
    }

    func stop() {
        sequence?.cancel()
        player.stop()
        music?.stop()
        music = nil
        isPlaying = false
        NowPlayingCenter.shared.clear()
    }

    func reset() {
        stop()
        windDown = nil
        stepIndex = 0
        soundElapsed = 0
        error = nil
    }

    private func applyLevels() {
        let levels = Self.levels(balance: balance)
        player.volume = levels.voice
        music?.setVolume(Self.musicVolume * levels.sound)
    }

    private func publishNowPlaying() {
        guard let windDown else { return }
        NowPlayingCenter.shared.update(NowPlayingCenter.Item(
            title: windDown.title,
            subtitle: currentText ?? "Wind down",
            artwork: nil,
            duration: 0,
            elapsed: 0,
            isPlaying: isPlaying
        ))
    }

    private func startMusic(for windDown: DiscoverWindDown) async {
        if let music {
            applyLevels()
            music.play()
            return
        }

        guard windDown.ambient == true,
              let data = try? await apiClient.fetchDiscoverWindDownBed(windDown.sceneBed),
              let music = CrossfadeLooper(data: data, volume: Self.musicVolume * Self.levels(balance: balance).sound) else {
            return
        }

        self.music = music
        music.play()
    }

    private func play(_ windDown: DiscoverWindDown) async {
        if windDown.isSoundOnly {
            while soundElapsed < windDown.minutes * 60 {
                try? await Task.sleep(for: .seconds(1))
                guard !Task.isCancelled else { return }
                soundElapsed += 1
            }
        } else {
            for index in min(stepIndex, windDown.steps.count)..<windDown.steps.count {
                guard !Task.isCancelled else { return }
                stepIndex = index
                publishNowPlaying()
                let step = windDown.steps[index]

                if step.audio, let data = try? await apiClient.fetchDiscoverWindDownStepAudio(id: windDown.id, step: index) {
                    try? await player.load(data, autoplay: true)
                    while player.isPlaying, !Task.isCancelled {
                        try? await Task.sleep(for: .milliseconds(200))
                    }
                }

                try? await Task.sleep(for: .seconds(step.pauseSeconds))
            }
        }

        guard !Task.isCancelled else { return }
        await finish()
    }

    private func finish() async {
        isPlaying = false
        stepIndex = 0
        soundElapsed = 0
        publishNowPlaying()

        let tail = afterVoiceMinutes * 60
        if tail > Self.tailFadeSeconds {
            try? await Task.sleep(for: .seconds(tail - Self.tailFadeSeconds))
            guard !Task.isCancelled else { return }
        }

        let fade = tail > 0 ? Self.tailFadeSeconds : Self.endFadeSeconds
        music?.fadeOut(over: TimeInterval(fade))
        try? await Task.sleep(for: .seconds(fade))
        guard !Task.isCancelled else { return }
        music?.stop()
        music = nil
    }
}
