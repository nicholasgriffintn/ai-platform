import SwiftUI

struct ExternalDisplayView: View {
    @EnvironmentObject private var stage: ExternalDisplayStage

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if let controller = stage.episode {
                ExternalEpisodeView(controller: controller)
            } else {
                VStack(spacing: 20) {
                    PolyMark(size: 160)
                    Text("Polychat")
                        .font(.polychatDisplay(.largeTitle))
                        .foregroundStyle(.white)
                    Text("Play an episode on your phone and it will appear here.")
                        .font(.title3)
                        .foregroundStyle(.white.opacity(0.7))
                }
            }
        }
    }
}

private struct ExternalEpisodeView: View {
    @ObservedObject var controller: EpisodePlaybackController

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            if let image = controller.shotImage {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .id(image)
                    .transition(.opacity)
            }

            VStack(alignment: .leading, spacing: 8) {
                if let episode = controller.episode {
                    Text(episode.title)
                        .font(.polychatDisplay(.title))
                    if let chapter = controller.chapter {
                        Text(chapter.title)
                            .font(.title3)
                            .opacity(0.8)
                    }
                }
                if let caption = controller.caption, !caption.isEmpty {
                    Text(caption)
                        .font(.title2)
                        .padding(.top, 8)
                }
            }
            .foregroundStyle(.white)
            .padding(48)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                LinearGradient(colors: [.clear, .black.opacity(0.85)], startPoint: .top, endPoint: .bottom)
            )
        }
        .animation(.easeInOut(duration: 0.8), value: controller.shotImage)
    }
}
