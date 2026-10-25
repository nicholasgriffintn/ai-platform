import SwiftUI

struct TVCardView: View {
    @EnvironmentObject private var store: DiscoverStore
    @Environment(\.dismiss) private var dismiss
    let cardId: String

    private var card: DiscoverCard? {
        store.discover?.edition?.cards.first { $0.id == cardId }
    }

    var body: some View {
        ZStack {
            TVBackdrop()

            if let card {
                detail(card)
                    .task { await store.send("opened", for: card) }
            } else {
                Text("That card has moved on. Today's edition has fresher ones.")
                    .font(.title3)
                    .foregroundStyle(Color.polychat.textMuted)
            }
        }
    }

    private func detail(_ card: DiscoverCard) -> some View {
        HStack(alignment: .center, spacing: 90) {
            VStack(alignment: .leading, spacing: 28) {
                if let label = card.topic ?? card.source {
                    TVSectionHeader(title: label)
                }
                Text(card.headline)
                    .font(.polychatDisplay(.largeTitle))
                    .foregroundStyle(Color.polychat.text)
                    .fixedSize(horizontal: false, vertical: true)
                if let body = card.body {
                    Text(body)
                        .font(.title3)
                        .foregroundStyle(Color.polychat.text)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Text(card.reason)
                    .font(.callout)
                    .foregroundStyle(Color.polychat.textMuted)
                let meta = [card.source, card.when, card.where].compactMap { $0 }
                if !meta.isEmpty {
                    Text(meta.joined(separator: " · "))
                        .font(.callout)
                        .foregroundStyle(Color.polychat.textMuted)
                }

                HStack(spacing: 32) {
                    Button {
                        send("more", card)
                    } label: {
                        Label("More like this", systemImage: "hand.thumbsup")
                    }
                    Button {
                        send("less", card)
                    } label: {
                        Label("Less like this", systemImage: "hand.thumbsdown")
                    }
                    Button(role: .destructive) {
                        send("hide", card)
                        dismiss()
                    } label: {
                        Label("Hide", systemImage: "eye.slash")
                    }
                }
                .padding(.top, 12)
            }
            .frame(maxWidth: 1000, alignment: .leading)

            ZStack {
                LinearGradient(
                    colors: [Color.polychat.primary.opacity(0.55), Color.polychat.creative.opacity(0.45)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                if let cover = card.coverId.flatMap({ store.covers[$0] }) {
                    Image(uiImage: cover)
                        .resizable()
                        .scaledToFill()
                } else {
                    Image(systemName: card.systemImage)
                        .font(.system(size: 96))
                        .foregroundStyle(.white.opacity(0.85))
                }
            }
            .frame(width: 680, height: 382)
            .clipShape(RoundedRectangle(cornerRadius: 32, style: .continuous))
            .shadow(color: .black.opacity(0.35), radius: 30, y: 16)
        }
        .padding(.horizontal, 90)
    }

    private func send(_ signal: String, _ card: DiscoverCard) {
        Task { await store.send(signal, for: card) }
    }
}
