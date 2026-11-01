import SwiftUI

struct DiscoverCardBlock: View {
    let card: DiscoverCard
    let cover: UIImage?
    let isFollowing: Bool
    let related: [DiscoverCard]
    let onOpenLink: () -> Void
    let onToggleFollow: (String) -> Void
    let onSelect: (DiscoverCard) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            lead

            if let body = card.body {
                if card.isSummarised {
                    VStack(alignment: .leading, spacing: 8) {
                        EyebrowLabel("Summary")
                        bodyText(body)
                    }
                } else {
                    bodyText(body)
                }
            }

            (Text("Why this: ").fontWeight(.medium).foregroundColor(Color.polychat.text) + Text(card.reason))
                .font(.subheadline)
                .foregroundStyle(Color.polychat.textMuted)

            actions

            if let topic = card.topic {
                topicRow(topic)
            }

            if !related.isEmpty {
                relatedReading
            }
        }
    }

    @ViewBuilder
    private var lead: some View {
        switch card.kind {
        case "topic":
            VStack(alignment: .leading, spacing: 14) {
                ZStack(alignment: .topLeading) {
                    if let cover {
                        Image(uiImage: cover)
                            .resizable()
                            .scaledToFill()
                    } else {
                        LinearGradient(
                            colors: [Color.polychat.primary.opacity(0.55), Color.polychat.creative.opacity(0.45)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    }
                    if isFollowing {
                        Text("Following")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(.black.opacity(0.55), in: Capsule())
                            .padding(12)
                    }
                }
                .frame(height: 220)
                .frame(maxWidth: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Color.polychat.border, lineWidth: 1))

                VStack(alignment: .leading, spacing: 6) {
                    EyebrowLabel(card.eyebrow)
                    headline
                }
            }
        case "check_in":
            VStack(alignment: .leading, spacing: 12) {
                PolyMark(size: 34)
                    .frame(width: 42, height: 42)
                    .background(Color.polychat.primary.opacity(0.12), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                headline
            }
        case "read", "inbox":
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 10) {
                    FaviconView(url: card.kind == "read" ? card.url : nil, fallbackSystemImage: card.systemImage, size: 32)
                    Text(card.eyebrow)
                        .font(.subheadline)
                        .foregroundStyle(Color.polychat.textMuted)
                        .lineLimit(1)
                }
                headline
            }
        default:
            VStack(alignment: .leading, spacing: 12) {
                Image(systemName: card.systemImage)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Color.polychat.primary)
                    .frame(width: 42, height: 42)
                    .background(Color.polychat.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Color.polychat.border, lineWidth: 1))
                VStack(alignment: .leading, spacing: 6) {
                    EyebrowLabel(card.eyebrow)
                    headline
                }
            }
        }
    }

    private var headline: some View {
        Text(card.headline)
            .font(.polychatDisplay(.title))
            .italic(card.kind == "check_in")
            .foregroundStyle(Color.polychat.text)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func bodyText(_ text: String) -> some View {
        Text(text)
            .font(.body)
            .foregroundStyle(Color.polychat.text)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var listenSourceId: String? {
        card.kind == "read" ? card.sourceId : nil
    }

    @ViewBuilder
    private var actions: some View {
        let label = card.linkLabel
        if label != nil || listenSourceId != nil {
            FlowLayout(spacing: 8) {
                if let label {
                    Button(action: onOpenLink) {
                        Label(label, systemImage: "arrow.up.right")
                            .lineLimit(1)
                    }
                    .buttonStyle(.borderedProminent)
                    .buttonBorderShape(.capsule)
                    .controlSize(.regular)
                    .font(.subheadline.weight(.medium))
                    .tint(Color.polychat.primary)
                }
                if let listenSourceId {
                    ReadAloudView(sourceId: listenSourceId)
                }
            }
        }
    }

    private func topicRow(_ topic: String) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Topic")
                    .font(.caption)
                    .foregroundStyle(Color.polychat.textMuted)
                Text(topic)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Color.polychat.text)
                    .lineLimit(2)
            }
            Spacer(minLength: 8)
            Button {
                onToggleFollow(topic)
            } label: {
                Label(isFollowing ? "Following" : "Follow", systemImage: isFollowing ? "checkmark" : "bell")
                    .lineLimit(1)
            }
            .buttonStyle(.bordered)
            .buttonBorderShape(.capsule)
            .controlSize(.small)
            .font(.footnote.weight(.medium))
            .tint(isFollowing ? Color.polychat.primary : Color.polychat.text)
        }
        .padding(12)
        .background(Color.polychat.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Color.polychat.border, lineWidth: 1))
    }

    private var relatedReading: some View {
        VStack(alignment: .leading, spacing: 8) {
            EyebrowLabel("Also in your reading")
            VStack(spacing: 0) {
                Divider()
                ForEach(related) { entry in
                    Button {
                        onSelect(entry)
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(entry.eyebrow)
                                .font(.caption)
                                .foregroundStyle(Color.polychat.textMuted)
                                .lineLimit(1)
                            Text(entry.headline)
                                .font(.subheadline)
                                .foregroundStyle(Color.polychat.text)
                                .lineLimit(1)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 10)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    Divider()
                }
            }
        }
    }
}
