import SwiftUI
import WatchKit

struct WatchWindDownView: View {
    @StateObject private var controller = WindDownPlaybackController()
    @State private var kind = DiscoverWindDown.kinds[0].id
    @State private var minutes = DiscoverWindDown.lengths[1]
    @State private var listeningSince: Date?
    @State private var healthMessage: String?
    @State private var isLoading = true

    private let apiClient = APIClient.shared

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                if let windDown = controller.windDown, windDown.isReady {
                    Text(windDown.title).font(.headline)
                    if let text = controller.currentText, controller.isPlaying {
                        Text(text)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .transition(.opacity)
                    }
                    Button {
                        controller.togglePlayback()
                    } label: {
                        Label(controller.isPlaying ? "Pause" : "Begin",
                              systemImage: controller.isPlaying ? "pause.fill" : "play.fill")
                    }
                    .buttonStyle(.borderedProminent)
                    Button("Choose another") { controller.reset() }
                        .font(.footnote)
                } else if let windDown = controller.windDown, windDown.status != "failed" {
                    Text("Settling in. Poly is recording your wind down.")
                        .font(.footnote)
                    ProgressView()
                } else if isLoading {
                    ProgressView()
                } else {
                    if let tonight = controller.tonight {
                        Button {
                            Task { await start(tonight.request(aboutToday: true)) }
                        } label: {
                            VStack(alignment: .leading) {
                                Text("Tonight: \(DiscoverWindDown.title(forKind: tonight.kind))")
                                Text(tonight.reason).font(.footnote).foregroundStyle(.secondary)
                            }
                        }
                        .disabled(controller.isWorking)
                    }
                    Picker("Kind", selection: $kind) {
                        ForEach(DiscoverWindDown.kinds.filter { $0.id != "read_back" || controller.tonight?.readBack == true }) {
                            Text($0.title).tag($0.id)
                        }
                    }
                    Picker("Length", selection: $minutes) {
                        ForEach(DiscoverWindDown.lengths, id: \.self) { Text("\($0) min").tag($0) }
                    }
                    Button {
                        Task { await start(DiscoverWindDownRequest(kind: kind, minutes: minutes)) }
                    } label: {
                        if controller.isWorking { ProgressView() } else { Text("Start") }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(controller.isWorking)
                }

                if let error = controller.error {
                    Text(error).font(.footnote).foregroundStyle(.secondary)
                }
                if let healthMessage {
                    Text(healthMessage).font(.footnote).foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Wind down")
        .animation(.easeInOut, value: controller.stepIndex)
        .onChange(of: controller.stepIndex) { _, _ in
            if controller.isPlaying {
                WKInterfaceDevice.current().play(.click)
            }
        }
        .onChange(of: controller.isPlaying) { _, playing in
            if playing {
                listeningSince = Date()
            } else {
                recordListening()
            }
        }
        .task { await loadToday() }
        .onDisappear {
            controller.stop()
            recordListening()
        }
    }

    private func loadToday() async {
        defer { isLoading = false }
        await controller.loadTonight()
        guard let id = try? await apiClient.fetchDiscover().windDownId else { return }
        await controller.load(id: id)
        await controller.waitUntilReady()
    }

    private func start(_ request: DiscoverWindDownRequest) async {
        healthMessage = nil
        await controller.start(request)
    }

    private func recordListening() {
        guard let start = listeningSince else { return }
        listeningSince = nil
        let end = Date()
        Task {
            if let message = await MindfulMinutes.save(from: start, to: end) {
                healthMessage = message
            }
        }
    }
}
