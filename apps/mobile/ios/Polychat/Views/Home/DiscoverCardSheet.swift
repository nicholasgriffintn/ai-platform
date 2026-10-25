import SwiftUI

struct DiscoverCardSheet: View {
    let card: DiscoverCard
    let cover: UIImage?
    let signals: [String]
    let isFollowing: Bool
    let onAsk: () -> Void
    let onOpenLink: () -> Void
    let onFeedback: (String) -> Void
    let onToggleFollow: (String) -> Void

    private var isSaved: Bool { signals.contains("saved") }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if let cover {
                    Image(uiImage: cover)
                        .resizable()
                        .scaledToFill()
                        .frame(height: 160)
                        .frame(maxWidth: .infinity)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                if let label = card.topic ?? card.source {
                    EyebrowLabel(label)
                }
                Text(card.headline)
                    .font(.polychatDisplay(.title3))
                    .foregroundStyle(Color.polychat.text)
                if let body = card.body {
                    Text(body)
                        .font(.body)
                        .foregroundStyle(Color.polychat.text)
                }
                Text(card.reason)
                    .font(.footnote)
                    .foregroundStyle(Color.polychat.textMuted)

                VStack(spacing: 10) {
                    Button(action: onAsk) {
                        Label("Ask Poly about this", systemImage: "bubble.left.and.text.bubble.right")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .tint(Color.polychat.primary)

                    if card.externalURL != nil {
                        Button(action: onOpenLink) {
                            Label("Open \(card.source ?? "link")", systemImage: "arrow.up.right")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.large)
                    }

                    HStack(spacing: 10) {
                        Button {
                            onFeedback("saved")
                        } label: {
                            Label(isSaved ? "Saved" : "Save", systemImage: isSaved ? "bookmark.fill" : "bookmark")
                                .frame(maxWidth: .infinity)
                        }
                        .disabled(isSaved)

                        if let topic = card.topic {
                            Button {
                                onToggleFollow(topic)
                            } label: {
                                Label(
                                    isFollowing ? "Following" : "Follow \(topic)",
                                    systemImage: isFollowing ? "checkmark" : "plus"
                                )
                                .lineLimit(1)
                                .frame(maxWidth: .infinity)
                            }
                        }
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.large)
                }

                HStack(spacing: 16) {
                    Button("More like this") { onFeedback("more") }
                    Button("Less like this") { onFeedback("less") }
                    Spacer()
                    Button("Hide", role: .destructive) { onFeedback("hide") }
                }
                .font(.footnote.weight(.medium))
            }
            .padding(20)
        }
        .background(Color.polychat.background)
    }
}
