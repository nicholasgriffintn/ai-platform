import SwiftUI

struct TVWindDownView: View {
    @EnvironmentObject private var store: DiscoverStore
    @StateObject private var controller = WindDownPlaybackController()
    @State private var kind = DiscoverWindDown.kinds[0].id
    @State private var minutes = DiscoverWindDown.lengths[1]

    private static let mixStops: [(label: String, value: Double)] = [
        ("Sound only", 0),
        ("More sound", 0.25),
        ("Even", 0.5),
        ("More voice", 0.75),
        ("Voice only", 1)
    ]

    private var kinds: [DiscoverWindDown.Kind] {
        DiscoverWindDown.kinds.filter { option in
            option.id != "park" && (option.id != "read_back" || controller.tonight?.readBack == true)
        }
    }

    var body: some View {
        ZStack {
            WindDownSceneView(
                bed: controller.windDown?.sceneBed ?? controller.tonight?.bed ?? "night",
                seed: controller.windDown?.id ?? "wind-down",
                moving: controller.isPlaying
            )
            .ignoresSafeArea()
            Color.black.opacity(0.25).ignoresSafeArea()

            VStack(spacing: 48) {
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
        .task { await controller.loadTonight() }
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

        Picker("Mix", selection: $controller.balance) {
            ForEach(Self.mixStops, id: \.value) { Text($0.label).tag($0.value) }
        }
        .pickerStyle(.segmented)
        .frame(maxWidth: 1000)
    }

    private var chooser: some View {
        VStack(spacing: 40) {
            VStack(spacing: 16) {
                Text("Wind down")
                    .font(.polychatDisplay(.largeTitle))
                Text(controller.tonight?.reason ?? "Poly records a session for tonight.")
                    .font(.title3)
                    .opacity(0.8)
            }

            if let tonight = controller.tonight, tonight.kind != "park" {
                Button {
                    Task { await controller.start(tonight.request(aboutToday: false)) }
                } label: {
                    Label("Tonight: \(DiscoverWindDown.title(forKind: tonight.kind)), \(tonight.minutes) minutes", systemImage: "moon.stars")
                }
                .disabled(controller.isWorking)
            }

            Picker("Kind", selection: $kind) {
                ForEach(kinds) { Text($0.title).tag($0.id) }
            }
            .pickerStyle(.segmented)
            .frame(maxWidth: 1300)

            Picker("Length", selection: $minutes) {
                ForEach(DiscoverWindDown.lengths, id: \.self) { Text("\($0) minutes").tag($0) }
            }
            .pickerStyle(.segmented)
            .frame(maxWidth: 1000)

            Button {
                Task {
                    await controller.start(DiscoverWindDownRequest(kind: kind, minutes: minutes, aboutToday: false))
                }
            } label: {
                if controller.isWorking { ProgressView() } else { Label("Start", systemImage: "play.fill") }
            }
            .disabled(controller.isWorking)
        }
    }
}
