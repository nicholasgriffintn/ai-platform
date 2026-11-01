import SwiftUI

struct ReadAloudView: View {
    let sourceId: String
    @StateObject private var controller = ReadAloudController()

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let listen = controller.listen, !listen.isFailed {
                transport(listen)
            } else {
                start
            }
        }
        .task(id: sourceId) {
            await controller.load(id: sourceId)
            await controller.waitUntilPlayable()
        }
        .onDisappear { controller.stop() }
    }

    private var start: some View {
        let failed = controller.listen?.isFailed == true
        return VStack(alignment: .leading, spacing: 6) {
            Button {
                Task { await controller.start() }
            } label: {
                Label {
                    Text(failed ? "Try reading it aloud again" : "Listen")
                } icon: {
                    if controller.isWorking {
                        ProgressView().controlSize(.small)
                    } else {
                        Image(systemName: "headphones")
                    }
                }
                .lineLimit(1)
            }
            .buttonStyle(.bordered)
            .buttonBorderShape(.capsule)
            .controlSize(.regular)
            .font(.subheadline.weight(.medium))
            .tint(Color.polychat.text)
            .disabled(controller.isWorking || controller.source == nil)

            if let note = controller.error ?? (failed ? "Reading aloud didn't finish." : nil) {
                Text(note)
                    .font(.caption)
                    .foregroundStyle(Color.polychat.textMuted)
            }
        }
    }

    private func transport(_ listen: SourceListen) -> some View {
        let ready = listen.isPlayable
        let total = listen.passages.count
        return MediaTransport(
            isPlaying: controller.isPlaying,
            isBusy: !ready,
            progress: controller.progress,
            start: ready ? "Passage \(min(controller.passageIndex + 1, total)) of \(total)" : "Getting the first passage ready",
            end: "~\(listen.spokenMinutes) min",
            caption: controller.isPlaying ? controller.currentText : nil,
            onToggle: controller.togglePlayback
        )
    }
}
