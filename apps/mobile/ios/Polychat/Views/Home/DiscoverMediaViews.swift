import SwiftUI

struct DiscoverMediaShelf: View {
    let items: [DiscoverMediaItem]
    let states: [DiscoverMediaItem: DiscoverMediaState]
    let art: [DiscoverMediaItem: UIImage]
    let onSelect: (DiscoverMediaItem) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            EyebrowLabel("Watch and listen")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(items) { item in
                        Button { onSelect(item) } label: {
                            DiscoverMediaTile(item: item, state: states[item], image: art[item])
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }
}

private struct DiscoverMediaTile: View {
    let item: DiscoverMediaItem
    let state: DiscoverMediaState?
    let image: UIImage?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            LinearGradient(colors: item.colours, startPoint: .topLeading, endPoint: .bottomTrailing)
                .overlay {
                    if let image {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFill()
                    }
                }
                .overlay(alignment: .topLeading) {
                    Image(systemName: item.systemImage)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(width: 30, height: 30)
                        .background(.black.opacity(0.35), in: Circle())
                        .padding(10)
                }
                .frame(height: 104)
                .clipped()

            VStack(alignment: .leading, spacing: 4) {
                Text(item.title.uppercased())
                    .font(.caption2.weight(.semibold))
                    .tracking(0.6)
                    .foregroundStyle(Color.polychat.textMuted)
                    .lineLimit(1)
                Text(state?.title ?? item.subtitle)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.polychat.text)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
                HStack(spacing: 4) {
                    if state?.isReady == true {
                        Image(systemName: "play.fill").font(.caption2)
                    } else if state?.isWorking == true {
                        ProgressView().controlSize(.mini)
                    }
                    Text(state?.status ?? item.subtitle)
                        .font(.caption)
                        .lineLimit(1)
                }
                .foregroundStyle(Color.polychat.textMuted)
            }
            .padding(12)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(width: 220, height: 210)
        .background(Color.polychat.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Color.polychat.border, lineWidth: 1))
    }
}

struct DiscoverMediaSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var playback: DiscoverPlayback
    let item: DiscoverMediaItem
    let edition: DiscoverEdition
    let windDownId: String?
    let artwork: UIImage?
    let onRefresh: () async -> Void

    var body: some View {
        NavigationStack {
            Group {
                switch item {
                case .episode:
                    EpisodePlayerView(controller: playback.episode, edition: edition, artwork: artwork, onRefresh: onRefresh)
                case .perch:
                    SourceListenView(
                        controller: playback.listen(.perch, editionId: edition.id),
                        sourceId: edition.listenSourceId,
                        artwork: artwork,
                        onRefresh: onRefresh
                    )
                case .week:
                    SourceListenView(
                        controller: playback.listen(.week, editionId: edition.id),
                        sourceId: edition.weekSourceId,
                        artwork: artwork,
                        onRefresh: onRefresh
                    )
                case .windDown:
                    WindDownView(controller: playback.windDown, windDownId: windDownId)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(Color.polychat.background)
            .navigationTitle(item.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

private struct MediaArtwork: View {
    let item: DiscoverMediaItem
    var image: UIImage?

    var body: some View {
        ZStack {
            LinearGradient(colors: item.colours, startPoint: .topLeading, endPoint: .bottomTrailing)
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .transition(.opacity)
            } else {
                Image(systemName: item.systemImage)
                    .font(.system(size: 54))
                    .foregroundStyle(.white.opacity(0.9))
            }
        }
        .aspectRatio(16 / 9, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .animation(.easeInOut(duration: 0.6), value: image)
    }
}

private struct PlaybackBar: View {
    @ObservedObject var player: AudioClipPlayer
    let isLoading: Bool
    let onToggle: () -> Void

    var body: some View {
        VStack(spacing: 8) {
            ProgressView(value: player.duration > 0 ? player.currentTime / player.duration : 0)
                .tint(Color.polychat.primary)
            HStack {
                Text(format(player.currentTime))
                Spacer()
                Button(action: onToggle) {
                    Group {
                        if isLoading {
                            ProgressView()
                        } else {
                            Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                        }
                    }
                    .font(.title2)
                    .frame(width: 56, height: 56)
                    .foregroundStyle(Color.polychat.primaryForeground)
                    .background(Color.polychat.primary, in: Circle())
                }
                .accessibilityLabel(player.isPlaying ? "Pause" : "Play")
                Spacer()
                Text(format(player.duration))
            }
            .font(.caption.monospacedDigit())
            .foregroundStyle(Color.polychat.textMuted)
        }
    }

    private func format(_ seconds: TimeInterval) -> String {
        let total = Int(seconds.rounded())
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}

private struct MediaNotice: View {
    let message: String
    var actionTitle: String?
    var isWorking = false
    var action: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(message)
                .font(.subheadline)
                .foregroundStyle(Color.polychat.textMuted)
            if let actionTitle, let action {
                Button(action: action) {
                    if isWorking {
                        ProgressView()
                    } else {
                        Text(actionTitle)
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.polychat.primary)
                .disabled(isWorking)
            }
        }
        .polychatCard()
    }
}

private struct EpisodePlayerView: View {
    @EnvironmentObject private var apiClient: APIClient
    @ObservedObject var controller: EpisodePlaybackController
    @State private var isRequesting = false
    let edition: DiscoverEdition
    let artwork: UIImage?
    let onRefresh: () async -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                MediaArtwork(item: .episode, image: controller.shotImage ?? artwork)

                if let episode = controller.episode {
                    VStack(alignment: .leading, spacing: 4) {
                        EyebrowLabel("Part \(episode.part) of \(episode.parts) · \(episode.topic)")
                        Text(episode.title).font(.polychatDisplay(.title2))
                        if let caption = controller.caption, !caption.isEmpty {
                            Text(caption).font(.subheadline).foregroundStyle(Color.polychat.textMuted)
                        }
                    }

                    HStack(spacing: 12) {
                        PlaybackBar(player: controller.player, isLoading: controller.isLoading) {
                            Task { await controller.togglePlayback() }
                        }
                        AirPlayButton()
                            .frame(width: 36, height: 36)
                            .accessibilityLabel("Play on Apple TV or speakers")
                    }

                    VStack(spacing: 0) {
                        ForEach(Array(episode.chapters.enumerated()), id: \.offset) { index, chapter in
                            Button {
                                Task { await controller.play(chapter: index, fromStart: true) }
                            } label: {
                                HStack {
                                    Text("\(index + 1). \(chapter.title)")
                                        .font(.subheadline.weight(index == controller.chapterIndex ? .semibold : .regular))
                                        .foregroundStyle(Color.polychat.text)
                                    Spacer()
                                    if !chapter.isReady {
                                        StatusPill(label: chapter.status == "failed" ? "Failed" : "Recording", tint: Color.polychat.attention)
                                    }
                                }
                                .padding(.vertical, 10)
                            }
                            .disabled(!chapter.isReady)
                            if index < episode.chapters.count - 1 { Divider() }
                        }
                    }
                    .polychatCard(padding: 12)

                    if !episode.recap.isEmpty {
                        Text(episode.recap).font(.footnote).foregroundStyle(Color.polychat.textMuted)
                    }
                } else if edition.episodeId == nil {
                    MediaNotice(
                        message: edition.episodeOverBudget == true
                            ? "This month's Discover budget is spent. Raise it in settings on the web to make today's part."
                            : "Today's part of a five-day season on your top topic.",
                        actionTitle: "Make it",
                        isWorking: isRequesting,
                        action: request
                    )
                } else if controller.isLoading {
                    ProgressView().frame(maxWidth: .infinity)
                }

                if let error = controller.error {
                    InlineErrorBanner(message: error)
                }
            }
            .padding(16)
        }
        .task(id: edition.episodeId) {
            if let id = edition.episodeId {
                await controller.follow(id: id)
            }
        }
    }

    private func request() {
        isRequesting = true
        Task {
            do {
                try await apiClient.requestDiscoverEpisode(editionId: edition.id)
                await onRefresh()
            } catch {
                controller.error = "The episode could not be started: \(error.localizedDescription)"
            }
            isRequesting = false
        }
    }
}

private struct SourceListenView: View {
    @ObservedObject var controller: ListenPlaybackController
    let sourceId: String?
    let artwork: UIImage?
    let onRefresh: () async -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            MediaArtwork(item: controller.item, image: artwork)

            if let source = controller.source, source.isPlayable {
                Text(source.title).font(.polychatDisplay(.title3))
                HStack(spacing: 12) {
                    PlaybackBar(player: controller.player, isLoading: controller.isWorking) {
                        Task { await controller.togglePlayback() }
                    }
                    AirPlayButton()
                        .frame(width: 36, height: 36)
                        .accessibilityLabel("Play on Apple TV or speakers")
                }
            } else if sourceId == nil && !controller.requested {
                MediaNotice(
                    message: controller.item == .week
                        ? "A short private recap of what you made, learned and finished this week."
                        : "A short two-host round-up of today's edition.",
                    actionTitle: "Record it",
                    isWorking: controller.isWorking,
                    action: record
                )
            } else if controller.source?.status == "failed" {
                MediaNotice(message: "That recording didn't take.", actionTitle: "Try again", isWorking: controller.isWorking, action: record)
            } else {
                MediaNotice(message: "Recording. It plays here when it's ready, so carry on with the edition.")
            }

            if let error = controller.error {
                InlineErrorBanner(message: error)
            }
        }
        .padding(16)
        .task(id: sourceId != nil || controller.requested) {
            await controller.follow(hasRecording: sourceId != nil, artwork: artwork)
        }
    }

    private func record() {
        Task { await controller.record(onRefresh: onRefresh) }
    }
}

private struct WindDownView: View {
    @ObservedObject var controller: WindDownPlaybackController
    @State private var kind = "breathing"
    @State private var minutes = 5
    let windDownId: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            MediaArtwork(item: .windDown)

            if let windDown = controller.windDown, windDown.isReady {
                Text(windDown.title).font(.polychatDisplay(.title3))
                if let text = controller.currentText, controller.isPlaying {
                    Text(text)
                        .font(.body)
                        .foregroundStyle(Color.polychat.textMuted)
                        .transition(.opacity)
                }
                HStack(spacing: 12) {
                    Button {
                        controller.togglePlayback()
                    } label: {
                        Label(controller.isPlaying ? "Pause" : "Begin", systemImage: controller.isPlaying ? "pause.fill" : "play.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .tint(Color.polychat.primary)
                    AirPlayButton()
                        .frame(width: 36, height: 36)
                        .accessibilityLabel("Play on Apple TV or speakers")
                }
                Button("Choose another") {
                    controller.stop()
                    Task { await controller.start(kind: kind, minutes: minutes) }
                }
                .font(.footnote)
            } else if let windDown = controller.windDown, windDown.status != "failed" {
                MediaNotice(message: "Settling in. Poly is recording your wind down.")
            } else {
                Picker("Kind", selection: $kind) {
                    ForEach(DiscoverWindDown.kinds) { Text($0.title).tag($0.id) }
                }
                .pickerStyle(.segmented)
                Picker("Length", selection: $minutes) {
                    ForEach(DiscoverWindDown.lengths, id: \.self) { Text("\($0) min").tag($0) }
                }
                .pickerStyle(.segmented)
                Button {
                    Task { await controller.start(kind: kind, minutes: minutes) }
                } label: {
                    Group {
                        if controller.isWorking { ProgressView() } else { Text("Start") }
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .tint(Color.polychat.primary)
                .disabled(controller.isWorking)
            }

            if let error = controller.error {
                InlineErrorBanner(message: error)
            }
        }
        .padding(16)
        .animation(.easeInOut, value: controller.stepIndex)
        .task(id: windDownId) {
            if let windDownId, controller.windDown?.id != windDownId {
                await controller.load(id: windDownId)
            }
            await controller.waitUntilReady()
        }
    }
}
