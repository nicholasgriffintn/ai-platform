import SwiftUI

struct TVListenView: View {
    @EnvironmentObject private var store: DiscoverStore
    let item: DiscoverMediaItem

    var body: some View {
        if let edition = store.discover?.edition {
            TVListenPlayer(
                item: item,
                edition: edition,
                sourceId: item == .week ? edition.weekSourceId : edition.listenSourceId,
                artwork: store.mediaArt[item]
            )
        } else {
            ZStack {
                TVBackdrop(colours: item.colours)
                ProgressView()
            }
        }
    }
}

private struct TVListenPlayer: View {
    @EnvironmentObject private var store: DiscoverStore
    @StateObject private var controller: ListenPlaybackController
    let sourceId: String?
    let artwork: UIImage?

    init(item: DiscoverMediaItem, edition: DiscoverEdition, sourceId: String?, artwork: UIImage?) {
        _controller = StateObject(wrappedValue: ListenPlaybackController(item: item, editionId: edition.id))
        self.sourceId = sourceId
        self.artwork = artwork
    }

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(colors: controller.item.colours, startPoint: .topLeading, endPoint: .bottomTrailing)
                .ignoresSafeArea()
            if let artwork {
                Image(uiImage: artwork)
                    .resizable()
                    .scaledToFill()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipped()
                    .ignoresSafeArea()
            }
            LinearGradient(colors: [.clear, .black.opacity(0.55), .black.opacity(0.92)], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 24) {
                Text(controller.item.title.uppercased())
                    .font(.callout.weight(.semibold))
                    .tracking(1.6)
                    .opacity(0.75)

                if let source = controller.source, source.isPlayable {
                    Text(source.title)
                        .font(.polychatDisplay(.largeTitle))
                    TVPlaybackProgress(player: controller.player)
                    Button {
                        Task { await controller.togglePlayback() }
                    } label: {
                        if controller.isWorking {
                            ProgressView()
                        } else {
                            Label(controller.player.isPlaying ? "Pause" : "Play",
                                  systemImage: controller.player.isPlaying ? "pause.fill" : "play.fill")
                                .frame(minWidth: 220)
                        }
                    }
                } else if sourceId == nil && !controller.requested {
                    Text(controller.item == .week ? "Your week, told back" : "Today's round-up")
                        .font(.polychatDisplay(.largeTitle))
                    Text(controller.item == .week
                         ? "A short private recap of what you made, learned and finished this week."
                         : "A short two-host round-up of today's edition.")
                        .font(.title3)
                        .opacity(0.85)
                    Button {
                        Task { await controller.record { await store.refresh() } }
                    } label: {
                        if controller.isWorking { ProgressView() } else { Label("Record it", systemImage: "mic") }
                    }
                    .disabled(controller.isWorking)
                } else if controller.source?.status == "failed" {
                    Text("That recording did not take.")
                        .font(.polychatDisplay(.title2))
                    Button("Try again") {
                        Task { await controller.record { await store.refresh() } }
                    }
                } else {
                    Text("Recording")
                        .font(.polychatDisplay(.largeTitle))
                    Text("It plays here when it is ready.")
                        .font(.title3)
                        .opacity(0.85)
                    ProgressView().tint(.white)
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
        .onPlayPauseCommand {
            Task { await controller.togglePlayback() }
        }
        .task(id: sourceId != nil || controller.requested) {
            await controller.follow(hasRecording: sourceId != nil, artwork: artwork)
        }
        .onDisappear { controller.stop() }
    }
}
