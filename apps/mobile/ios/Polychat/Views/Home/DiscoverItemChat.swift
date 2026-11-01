import SwiftUI

struct DiscoverItemSummary {
    enum Art {
        case media(DiscoverMediaItem, UIImage?)
        case card(DiscoverCard, UIImage?)
    }

    let title: String
    let kicker: String
    let art: Art
}

struct DiscoverItemTransport {
    let player: AudioClipPlayer
    let toggle: () async -> Void
}

struct DiscoverItemChat<Lead: View>: View {
    @EnvironmentObject private var conversationManager: ConversationManager
    @State private var ready = false
    @State private var expanded = false
    let subject: ConversationSubject
    let summary: DiscoverItemSummary
    let suggestions: [DiscoverSuggestion]
    let placeholder: String
    let player: DiscoverItemTransport?
    @ViewBuilder let lead: () -> Lead

    private var chatting: Bool {
        ready && conversationManager.currentConversation?.messages.isEmpty == false
    }

    var body: some View {
        VStack(spacing: 0) {
            if chatting {
                DiscoverCompactRow(summary: summary, transport: player, expanded: $expanded)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                if expanded {
                    ScrollView {
                        lead().padding(16)
                    }
                    .frame(maxHeight: 360)
                    .overlay(alignment: .bottom) { Divider() }
                    .transition(.move(edge: .top).combined(with: .opacity))
                }
            }

            if ready {
                ChatView(projectName: nil, placeholder: placeholder, showsTitle: false, welcome: { send in
                    AnyView(DiscoverWelcome(suggestions: suggestions, send: send, lead: lead))
                })
            } else {
                ScrollView {
                    DiscoverWelcome(suggestions: [], send: { _ in }, lead: lead)
                    ProgressView().padding(.top, 8)
                }
            }
        }
        .animation(.easeInOut(duration: 0.25), value: expanded)
        .task(id: subject) {
            ready = false
            if let conversationId = await conversationManager.latestConversationId(about: subject) {
                await conversationManager.loadConversationMessages(id: conversationId)
            } else {
                _ = conversationManager.startNewConversation(subject: subject)
            }
            ready = true
        }
    }
}

private struct DiscoverWelcome<Lead: View>: View {
    let suggestions: [DiscoverSuggestion]
    let send: (String) -> Void
    let lead: () -> Lead

    var body: some View {
        VStack(alignment: .leading, spacing: 28) {
            lead()

            if !suggestions.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Ask about this")
                        .font(.polychatDisplay(.title3))
                        .foregroundStyle(Color.polychat.text)
                    ForEach(suggestions) { suggestion in
                        Button {
                            send(suggestion.prompt)
                        } label: {
                            HStack(spacing: 10) {
                                Text(suggestion.label)
                                    .font(.subheadline)
                                    .foregroundStyle(Color.polychat.text)
                                    .multilineTextAlignment(.leading)
                                Spacer(minLength: 0)
                                Image(systemName: "arrow.up")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(Color.polychat.textMuted)
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .background(Color.polychat.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Color.polychat.border, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(16)
        .frame(maxWidth: 760)
        .frame(maxWidth: .infinity)
    }
}

private struct DiscoverCompactRow: View {
    let summary: DiscoverItemSummary
    let transport: DiscoverItemTransport?
    @Binding var expanded: Bool

    var body: some View {
        HStack(spacing: 12) {
            DiscoverItemThumb(art: summary.art)
            VStack(alignment: .leading, spacing: 6) {
                Text(summary.title)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Color.polychat.text)
                    .lineLimit(1)
                if let transport {
                    DiscoverMiniTransport(player: transport.player)
                } else {
                    Text(summary.kicker)
                        .font(.caption)
                        .foregroundStyle(Color.polychat.textMuted)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
            if let transport {
                DiscoverPlayButton(transport: transport, player: transport.player)
            }
            Button {
                expanded.toggle()
            } label: {
                Label(expanded ? "Hide" : "Show", systemImage: expanded ? "chevron.up" : "chevron.down")
                    .labelStyle(.titleAndIcon)
                    .font(.caption.weight(.medium))
            }
            .buttonStyle(.borderless)
            .tint(Color.polychat.textMuted)
        }
        .padding(8)
        .background(Color.polychat.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Color.polychat.border, lineWidth: 1))
    }
}

private struct DiscoverItemThumb: View {
    let art: DiscoverItemSummary.Art

    var body: some View {
        Group {
            switch art {
            case .media(let media, let image):
                ZStack {
                    LinearGradient(colors: media.colours, startPoint: .topLeading, endPoint: .bottomTrailing)
                    if let image {
                        Image(uiImage: image).resizable().scaledToFill()
                    } else {
                        Image(systemName: media.systemImage).foregroundStyle(.white)
                    }
                }
            case .card(let card, let image):
                if let image {
                    Image(uiImage: image).resizable().scaledToFill()
                } else {
                    FaviconView(url: card.kind == "read" ? card.url : nil, fallbackSystemImage: card.systemImage, size: 44)
                }
            }
        }
        .frame(width: 44, height: 44)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

private struct DiscoverMiniTransport: View {
    @ObservedObject var player: AudioClipPlayer

    var body: some View {
        HStack(spacing: 8) {
            ProgressView(value: player.duration > 0 ? min(1, player.currentTime / player.duration) : 0)
                .tint(Color.polychat.text)
            Text(Duration.seconds(player.currentTime).formatted(.time(pattern: .minuteSecond)))
                .font(.caption2.monospacedDigit())
                .foregroundStyle(Color.polychat.textMuted)
        }
    }
}

private struct DiscoverPlayButton: View {
    let transport: DiscoverItemTransport
    @ObservedObject var player: AudioClipPlayer

    var body: some View {
        Button {
            Task { await transport.toggle() }
        } label: {
            Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                .font(.footnote)
                .foregroundStyle(Color.polychat.background)
                .frame(width: 34, height: 34)
                .background(Color.polychat.text, in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(player.isPlaying ? "Pause" : "Play")
    }
}
