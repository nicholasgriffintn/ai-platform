import SwiftUI

struct ReadAloudView: View {
    let sourceId: String
    @StateObject private var controller = ReadAloudController()

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let listen = controller.listen, !listen.isFailed {
                if listen.isPlayable {
                    ProgressView(value: controller.progress)
                        .tint(Color.polychat.primary)
                    HStack {
                        Button {
                            controller.togglePlayback()
                        } label: {
                            Label(controller.isPlaying ? "Pause" : "Listen", systemImage: controller.isPlaying ? "pause.fill" : "headphones")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.large)
                        AirPlayButton()
                            .frame(width: 36, height: 36)
                            .accessibilityLabel("Play on Apple TV or speakers")
                    }
                    Text("Passage \(min(controller.passageIndex + 1, listen.passages.count)) of \(listen.passages.count)")
                        .font(.caption)
                        .foregroundStyle(Color.polychat.textMuted)
                } else {
                    Label("Getting the first passage ready", systemImage: "waveform")
                        .font(.subheadline)
                        .foregroundStyle(Color.polychat.textMuted)
                }
            } else if controller.source != nil {
                Button {
                    Task { await controller.start() }
                } label: {
                    Group {
                        if controller.isWorking {
                            ProgressView()
                        } else {
                            Label(controller.listen?.isFailed == true ? "Try reading it aloud again" : "Listen", systemImage: "headphones")
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
                .disabled(controller.isWorking)
            }

            if let error = controller.error {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(Color.polychat.textMuted)
            }
        }
        .task(id: sourceId) {
            await controller.load(id: sourceId)
            await controller.waitUntilPlayable()
        }
        .onDisappear { controller.stop() }
    }
}
