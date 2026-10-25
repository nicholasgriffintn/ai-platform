import SwiftUI

struct DiscoverNowPlayingBar: View {
    @ObservedObject var playback: DiscoverPlayback
    let onOpen: (DiscoverMediaItem) -> Void

    var body: some View {
        if let item = playback.current {
            HStack(spacing: 12) {
                Button {
                    onOpen(item)
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: item.systemImage)
                            .font(.subheadline)
                            .foregroundStyle(.white)
                            .frame(width: 34, height: 34)
                            .background(
                                LinearGradient(colors: item.colours, startPoint: .topLeading, endPoint: .bottomTrailing),
                                in: RoundedRectangle(cornerRadius: 8, style: .continuous)
                            )
                        VStack(alignment: .leading, spacing: 1) {
                            Text(item.title)
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(Color.polychat.textMuted)
                            Text(playback.currentTitle ?? item.title)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Color.polychat.text)
                                .lineLimit(1)
                        }
                        Spacer(minLength: 0)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Open \(item.title)")

                Button {
                    Task { await playback.toggle() }
                } label: {
                    Image(systemName: playback.isPlaying ? "pause.fill" : "play.fill")
                        .font(.body)
                        .frame(width: 36, height: 36)
                }
                .accessibilityLabel(playback.isPlaying ? "Pause \(item.title)" : "Play \(item.title)")

                Button {
                    playback.stopAll()
                } label: {
                    Image(systemName: "xmark")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Color.polychat.textMuted)
                        .frame(width: 30, height: 30)
                }
                .accessibilityLabel("Stop \(item.title)")
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Color.polychat.border, lineWidth: 1))
            .padding(.horizontal, 12)
            .padding(.bottom, 6)
        }
    }
}
