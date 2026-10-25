import SwiftUI

struct TVWindDownView: View {
    @EnvironmentObject private var store: DiscoverStore
    @StateObject private var controller = WindDownPlaybackController()
    @State private var kind = DiscoverWindDown.kinds[0].id
    @State private var minutes = DiscoverWindDown.lengths[0]

    var body: some View {
        ZStack {
            LinearGradient(colors: DiscoverMediaItem.windDown.colours + [.black], startPoint: .topLeading, endPoint: .bottom)
                .ignoresSafeArea()

            VStack(spacing: 48) {
                Image(systemName: DiscoverMediaItem.windDown.systemImage)
                    .font(.system(size: 96))
                    .foregroundStyle(.white.opacity(0.9))
                    .scaleEffect(controller.isPlaying ? 1.08 : 1)
                    .animation(controller.isPlaying ? .easeInOut(duration: 4).repeatForever(autoreverses: true) : .default, value: controller.isPlaying)

                if let windDown = controller.windDown, windDown.isReady {
                    ready(windDown)
                } else if let windDown = controller.windDown, windDown.status != "failed" {
                    VStack(spacing: 24) {
                        Text("Settling in")
                            .font(.polychatDisplay(.largeTitle))
                        Text("Poly is recording your wind down. It starts here when it's ready.")
                            .font(.title3)
                            .opacity(0.8)
                        ProgressView().tint(.white)
                    }
                } else {
                    chooser
                }

                if let error = controller.error {
                    Text(error)
                        .font(.callout)
                        .foregroundStyle(Color.polychat.attention)
                }
            }
            .foregroundStyle(.white)
            .multilineTextAlignment(.center)
            .padding(90)
        }
        .animation(.easeInOut(duration: 1), value: controller.stepIndex)
        .onPlayPauseCommand { controller.togglePlayback() }
        .task(id: store.discover?.windDownId) {
            if let id = store.discover?.windDownId {
                await controller.load(id: id)
                await controller.waitUntilReady()
            }
        }
        .onDisappear { controller.stop() }
    }

    @ViewBuilder
    private func ready(_ windDown: DiscoverWindDown) -> some View {
        VStack(spacing: 28) {
            Text(windDown.title)
                .font(.polychatDisplay(.largeTitle))
            Text(controller.isPlaying ? (controller.currentText ?? "") : "\(windDown.minutes) minutes. Settle in, then begin.")
                .font(.title2)
                .opacity(0.9)
                .frame(maxWidth: 1300)
                .frame(minHeight: 160)
                .id(controller.stepIndex)
                .transition(.opacity)
        }

        HStack(spacing: 40) {
            Button {
                controller.togglePlayback()
            } label: {
                Label(controller.isPlaying ? "Pause" : "Begin", systemImage: controller.isPlaying ? "pause.fill" : "play.fill")
                    .frame(minWidth: 240)
            }
            Button("Choose another") { controller.reset() }
        }
    }

    private var chooser: some View {
        VStack(spacing: 40) {
            VStack(spacing: 16) {
                Text("Wind down")
                    .font(.polychatDisplay(.largeTitle))
                Text("Poly records a guided session for tonight.")
                    .font(.title3)
                    .opacity(0.8)
            }

            Picker("Kind", selection: $kind) {
                ForEach(DiscoverWindDown.kinds) { Text($0.title).tag($0.id) }
            }
            .pickerStyle(.segmented)
            .frame(maxWidth: 1000)

            Picker("Length", selection: $minutes) {
                ForEach(DiscoverWindDown.lengths, id: \.self) { Text("\($0) minutes").tag($0) }
            }
            .pickerStyle(.segmented)
            .frame(maxWidth: 1000)

            Button {
                Task { await controller.start(kind: kind, minutes: minutes) }
            } label: {
                if controller.isWorking { ProgressView() } else { Label("Start", systemImage: "moon.stars") }
            }
            .disabled(controller.isWorking)
        }
    }
}
