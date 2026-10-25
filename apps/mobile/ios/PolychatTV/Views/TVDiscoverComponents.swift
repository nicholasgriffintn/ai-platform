import SwiftUI

struct TVBackdrop: View {
    var colours: [Color] = [Color.polychat.primary.opacity(0.28), Color.polychat.creative.opacity(0.12)]

    var body: some View {
        ZStack {
            Color.polychat.canvas
            LinearGradient(
                colors: colours + [Color.polychat.canvas],
                startPoint: .topLeading,
                endPoint: .bottom
            )
        }
        .ignoresSafeArea()
    }
}

struct TVSectionHeader: View {
    let title: String

    var body: some View {
        Text(title.uppercased())
            .font(.callout.weight(.semibold))
            .tracking(1.6)
            .foregroundStyle(Color.polychat.textMuted)
    }
}

struct TVBriefPanel: View {
    let lines: [DiscoverBriefLine]

    private let columns = [GridItem(.flexible(), spacing: 48, alignment: .top), GridItem(.flexible(), spacing: 48, alignment: .top)]

    var body: some View {
        LazyVGrid(columns: columns, alignment: .leading, spacing: 32) {
            ForEach(lines) { line in
                HStack(alignment: .top, spacing: 20) {
                    Image(systemName: line.systemImage)
                        .font(.title3)
                        .foregroundStyle(Color.polychat.primary)
                        .frame(width: 44)
                    VStack(alignment: .leading, spacing: 6) {
                        Text(line.label)
                            .font(.callout.weight(.semibold))
                            .foregroundStyle(Color.polychat.textMuted)
                        Text(line.text)
                            .font(.title3)
                            .foregroundStyle(Color.polychat.text)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .padding(40)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.polychat.surface.opacity(0.85), in: RoundedRectangle(cornerRadius: 32, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 32, style: .continuous).stroke(Color.polychat.border, lineWidth: 1))
    }
}

struct TVMediaTile: View {
    let item: DiscoverMediaItem
    let state: DiscoverMediaState?
    let image: UIImage?

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(colors: item.colours, startPoint: .topLeading, endPoint: .bottomTrailing)
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                LinearGradient(colors: [.clear, .black.opacity(0.8)], startPoint: .center, endPoint: .bottom)
            }
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: item.systemImage)
                    .font(.title2)
                Spacer(minLength: 0)
                Text(item.title.uppercased())
                    .font(.caption.weight(.semibold))
                    .tracking(1.2)
                    .opacity(0.85)
                Text(state?.title ?? item.subtitle)
                    .font(.title3.weight(.semibold))
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 8) {
                    if state?.isReady == true {
                        Image(systemName: "play.fill")
                    } else if state?.isWorking == true {
                        ProgressView()
                    }
                    Text(state?.status ?? item.subtitle)
                        .lineLimit(1)
                }
                .font(.callout)
                .opacity(0.9)
            }
            .foregroundStyle(.white)
            .padding(32)
        }
        .frame(width: 560, height: 340)
    }
}

struct TVTopicTile: View {
    let card: DiscoverCard
    let cover: UIImage?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack {
                LinearGradient(
                    colors: [Color.polychat.primary.opacity(0.55), Color.polychat.creative.opacity(0.45)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                if let cover {
                    Image(uiImage: cover)
                        .resizable()
                        .scaledToFill()
                }
            }
            .frame(width: 480, height: 270)
            .clipped()

            VStack(alignment: .leading, spacing: 8) {
                if let topic = card.topic {
                    Text(topic.uppercased())
                        .font(.caption.weight(.semibold))
                        .tracking(1.2)
                        .foregroundStyle(Color.polychat.textMuted)
                        .lineLimit(1)
                }
                Text(card.headline)
                    .font(.headline)
                    .foregroundStyle(Color.polychat.text)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
            }
            .padding(24)
            .frame(width: 480, height: 170, alignment: .topLeading)
        }
        .background(Color.polychat.surface)
    }
}

struct TVRowCard: View {
    let card: DiscoverCard

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Image(systemName: card.systemImage)
                .font(.title3)
                .foregroundStyle(Color.polychat.primary)
                .frame(width: 60, height: 60)
                .background(Color.polychat.selection, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            Text(card.headline)
                .font(.headline)
                .foregroundStyle(Color.polychat.text)
                .lineLimit(3)
                .multilineTextAlignment(.leading)
            if let body = card.body {
                Text(body)
                    .font(.callout)
                    .foregroundStyle(Color.polychat.textMuted)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
            }
            Spacer(minLength: 0)
            let meta = [card.source, card.when, card.where].compactMap { $0 }
            if !meta.isEmpty {
                Text(meta.joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(Color.polychat.textMuted)
                    .lineLimit(1)
            }
        }
        .padding(32)
        .frame(width: 560, height: 380, alignment: .topLeading)
        .background(Color.polychat.surface)
    }
}

struct TVCodeCells: View {
    let code: String

    private var characters: [Character] {
        Array(code.filter { $0.isLetter || $0.isNumber })
    }

    var body: some View {
        HStack(spacing: 12) {
            ForEach(Array(characters.enumerated()), id: \.offset) { index, character in
                if index == characters.count / 2 {
                    Capsule()
                        .fill(Color.polychat.borderStrong)
                        .frame(width: 24, height: 4)
                }
                Text(String(character))
                    .font(.system(size: 56, weight: .semibold, design: .monospaced))
                    .foregroundStyle(Color.polychat.text)
                    .frame(width: 76, height: 96)
                    .background(Color.polychat.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Color.polychat.borderStrong, lineWidth: 2))
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Code \(code)")
    }
}

struct TVPlaybackProgress: View {
    @ObservedObject var player: AudioClipPlayer

    var body: some View {
        HStack(spacing: 24) {
            Text(Self.format(player.currentTime))
            ProgressView(value: player.duration > 0 ? player.currentTime / player.duration : 0)
                .tint(.white)
                .frame(maxWidth: 1300)
            Text(Self.format(player.duration))
        }
        .font(.callout.monospacedDigit())
        .opacity(0.85)
    }

    private static func format(_ seconds: TimeInterval) -> String {
        Duration.seconds(seconds.rounded()).formatted(.time(pattern: .minuteSecond))
    }
}
