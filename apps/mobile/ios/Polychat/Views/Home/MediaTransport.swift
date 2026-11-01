import SwiftUI

struct MediaTransport: View {
    let isPlaying: Bool
    let isBusy: Bool
    let progress: Double
    let start: String
    let end: String
    var caption: String?
    let onToggle: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                Button(action: onToggle) {
                    Group {
                        if isBusy {
                            ProgressView().controlSize(.small).tint(Color.polychat.background)
                        } else {
                            Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                                .font(.footnote)
                        }
                    }
                    .foregroundStyle(Color.polychat.background)
                    .frame(width: 36, height: 36)
                    .background(Color.polychat.text, in: Circle())
                }
                .buttonStyle(.plain)
                .disabled(isBusy)
                .accessibilityLabel(isPlaying ? "Pause" : "Play")

                VStack(alignment: .leading, spacing: 6) {
                    ProgressView(value: min(max(progress, 0), 1))
                        .tint(Color.polychat.text)
                    HStack {
                        Text(start)
                        Spacer(minLength: 8)
                        Text(end)
                    }
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(Color.polychat.textMuted)
                    .lineLimit(1)
                }

                AirPlayButton()
                    .frame(width: 28, height: 28)
                    .accessibilityLabel("Play on Apple TV or speakers")
            }

            if let caption {
                Text(caption)
                    .font(.footnote)
                    .foregroundStyle(Color.polychat.textMuted)
                    .lineLimit(3)
                    .transition(.opacity)
            }
        }
        .padding(12)
        .background(Color.polychat.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Color.polychat.border, lineWidth: 1))
        .animation(.easeInOut(duration: 0.2), value: caption)
    }
}
