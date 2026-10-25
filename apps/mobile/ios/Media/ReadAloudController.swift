import Foundation

@MainActor
final class ReadAloudController: ObservableObject {
    @Published private(set) var source: MediaSource?
    @Published private(set) var passageIndex = 0
    @Published private(set) var isPlaying = false
    @Published private(set) var isWorking = false
    @Published var error: String?

    let player = AudioClipPlayer()
    private let apiClient: APIClient
    private var sequence: Task<Void, Never>?

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    var listen: SourceListen? { source?.listen }

    var currentText: String? {
        listen.flatMap { $0.passages.indices.contains(passageIndex) ? $0.passages[passageIndex].text : nil }
    }

    var progress: Double {
        guard let listen, !listen.passages.isEmpty else { return 0 }
        return Double(passageIndex) / Double(listen.passages.count)
    }

    func load(id: String) async {
        do {
            source = try await apiClient.fetchSource(id: id)
            error = nil
        } catch {
            self.error = "This couldn't be loaded: \(error.localizedDescription)"
        }
    }

    func start() async {
        guard let id = source?.id else { return }
        isWorking = true
        defer { isWorking = false }
        do {
            source = try await apiClient.startSourceListen(id: id)
            error = nil
            await waitUntilPlayable()
        } catch {
            self.error = "It couldn't be read aloud: \(error.localizedDescription)"
        }
    }

    func waitUntilPlayable() async {
        while let current = source, let listen = current.listen, listen.isMaking, !listen.isPlayable, !Task.isCancelled {
            try? await Task.sleep(for: .seconds(3))
            await load(id: current.id)
        }
    }

    func togglePlayback() {
        if isPlaying {
            sequence?.cancel()
            player.pause()
            isPlaying = false
            publishNowPlaying()
            return
        }

        guard let source, source.listen?.isPlayable == true else { return }
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
            await self?.play(sourceId: source.id)
        }
    }

    func stop() {
        sequence?.cancel()
        player.stop()
        isPlaying = false
        NowPlayingCenter.shared.clear()
    }

    private func publishNowPlaying() {
        guard let source else { return }
        NowPlayingCenter.shared.update(NowPlayingCenter.Item(
            title: source.title,
            subtitle: "Read aloud",
            artwork: nil,
            duration: 0,
            elapsed: 0,
            isPlaying: isPlaying
        ))
    }

    private func play(sourceId: String) async {
        do {
            try await PlaybackSession.activate()
        } catch {
            self.error = "It couldn't play: \(error.localizedDescription)"
            isPlaying = false
            return
        }

        while !Task.isCancelled, let listen = source?.listen, passageIndex < listen.passages.count {
            guard listen.passages[passageIndex].audio else {
                if listen.isFailed {
                    error = "Reading aloud stopped part way through."
                    break
                }
                try? await Task.sleep(for: .seconds(3))
                await load(id: sourceId)
                continue
            }

            publishNowPlaying()
            if let data = try? await apiClient.fetchSourceListenPassage(id: sourceId, passage: passageIndex) {
                try? await player.load(data, autoplay: true)
                while player.isPlaying, !Task.isCancelled {
                    try? await Task.sleep(for: .milliseconds(200))
                }
            }

            guard !Task.isCancelled else { return }
            passageIndex += 1
        }

        guard !Task.isCancelled else { return }
        isPlaying = false
        passageIndex = 0
        publishNowPlaying()
    }
}
