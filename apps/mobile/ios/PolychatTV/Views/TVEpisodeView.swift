import SwiftUI

struct TVEpisodeView: View {
    @EnvironmentObject private var store: DiscoverStore
    @StateObject private var controller = EpisodePlaybackController()
    @State private var isRequesting = false

    private let apiClient = APIClient.shared

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(colors: DiscoverMediaItem.episode.colours, startPoint: .topLeading, endPoint: .bottomTrailing)
                .ignoresSafeArea()

            if let image = controller.shotImage ?? store.mediaArt[.episode] {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipped()
                    .id(image)
                    .transition(.opacity)
                    .ignoresSafeArea()
            }

            LinearGradient(colors: [.clear, .black.opacity(0.55), .black.opacity(0.92)], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 24) {
                if let episode = controller.episode {
                    player(episode)
                } else if let edition = store.discover?.edition, edition.episodeId == nil {
                    notMade(edition)
                } else {
                    ProgressView()
                }

                if let error = controller.error {
                    Text(error)
                        .font(.callout)
                        .foregroundStyle(Color.polychat.attention)
                }
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 90)
            .padding(.bottom, 70)
        }
        .animation(.easeInOut(duration: 0.8), value: controller.shotImage)
        .onPlayPauseCommand {
            Task { await controller.togglePlayback() }
        }
        .task(id: store.discover?.edition?.episodeId) {
            if let id = store.discover?.edition?.episodeId {
                await controller.follow(id: id)
            }
        }
        .onDisappear { controller.stop() }
    }

    @ViewBuilder
    private func player(_ episode: DiscoverEpisode) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Part \(episode.part) of \(episode.parts) · \(episode.topic)".uppercased())
                .font(.callout.weight(.semibold))
                .tracking(1.6)
                .opacity(0.75)
            Text(episode.title)
                .font(.polychatDisplay(.largeTitle))
            if let chapter = controller.chapter {
                Text(chapter.title)
                    .font(.title3)
                    .opacity(0.8)
            }
        }

        if let caption = controller.caption, !caption.isEmpty {
            Text(caption)
                .font(.title2)
                .frame(maxWidth: 1400, alignment: .leading)
                .transition(.opacity)
        }

        TVPlaybackProgress(player: controller.player)

        HStack(spacing: 32) {
            Button {
                Task { await controller.togglePlayback() }
            } label: {
                Label(controller.player.isPlaying ? "Pause" : "Play",
                      systemImage: controller.player.isPlaying ? "pause.fill" : "play.fill")
                    .frame(minWidth: 220)
            }
            .prefersDefaultFocus(true, in: namespace)

            ScrollView(.horizontal) {
                HStack(spacing: 24) {
                    ForEach(Array(episode.chapters.enumerated()), id: \.offset) { index, chapter in
                        Button {
                            Task { await controller.play(chapter: index) }
                        } label: {
                            Label(
                                "\(index + 1). \(chapter.title)",
                                systemImage: index == controller.chapterIndex ? "waveform" : chapter.isReady ? "play" : "clock"
                            )
                        }
                        .disabled(!chapter.isReady)
                    }
                }
                .padding(.vertical, 20)
            }
            .scrollClipDisabled()
        }
        .focusScope(namespace)
    }

    @Namespace private var namespace

    @ViewBuilder
    private func notMade(_ edition: DiscoverEdition) -> some View {
        Text(DiscoverMediaItem.episode.title.uppercased())
            .font(.callout.weight(.semibold))
            .tracking(1.6)
            .opacity(0.75)
        Text(store.media[.episode]?.title ?? "Today's episode")
            .font(.polychatDisplay(.largeTitle))
        Text(edition.episodeOverBudget == true
             ? "This month's Discover budget is spent. Raise it on the web to make today's part."
             : "Today's part of a five-day season on your top topic has not been made yet.")
            .font(.title3)
            .opacity(0.85)
            .frame(maxWidth: 1200, alignment: .leading)
        if edition.episodeOverBudget != true {
            Button {
                request(edition)
            } label: {
                if isRequesting { ProgressView() } else { Label("Make it", systemImage: "sparkles") }
            }
            .disabled(isRequesting)
        }
    }

    private func request(_ edition: DiscoverEdition) {
        isRequesting = true
        Task {
            do {
                try await apiClient.requestDiscoverEpisode(editionId: edition.id)
                while store.discover?.edition?.episodeId == nil, !Task.isCancelled {
                    await store.refresh()
                    try? await Task.sleep(for: .seconds(5))
                }
            } catch {
                controller.error = "The episode could not be started: \(error.localizedDescription)"
            }
            isRequesting = false
        }
    }
}
