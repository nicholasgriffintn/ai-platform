import SwiftUI

struct DiscoverView: View {
    @StateObject private var store = DiscoverStore()
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    let onStartConversation: (String) -> Void

    private let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    Text(greeting)
                        .font(.system(.largeTitle, design: .serif))
                        .padding(.top, 8)

                    if let discover = store.discover {
                        if let edition = discover.edition {
                            BriefCard(edition: edition)
                            topics(edition)
                            stories(edition)
                        } else if discover.settings.enabled {
                            emptyEdition
                        } else {
                            intro
                        }
                    } else if store.isLoading {
                        ProgressView().frame(maxWidth: .infinity)
                    }

                    if store.discover?.settings.enabled == true, HealthSummaryService.shared.isAvailable {
                        VStack(alignment: .leading, spacing: 4) {
                            Toggle(
                                "Use Apple Health for the brief",
                                isOn: Binding(
                                    get: { store.sharesAppleHealth },
                                    set: { enabled in Task { await store.setSharesAppleHealth(enabled) } }
                                )
                            )
                            Text("Yesterday's sleep, mindful and exercise minutes. Never used to choose topics.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    }

                    if let error = store.error {
                        Text(error).font(.footnote).foregroundStyle(.red)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
            .navigationTitle("Discover")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    if store.discover?.settings.enabled == true {
                        Button {
                            Task { await store.writeNow() }
                        } label: {
                            Image(systemName: "arrow.clockwise")
                        }
                        .accessibilityLabel("Write today's edition again")
                    }
                }
            }
            .refreshable { await store.refresh() }
            .task { await store.refresh() }
        }
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("A morning edition, made for you").font(.title2.weight(.semibold))
            Text("Each morning Poly looks at what you've been talking about and leaves an edition here: a brief, topics worth a look, links, automations worth setting up and things to do next.")
                .foregroundStyle(.secondary)
            Button("Turn on Discover") {
                Task { await store.turnOn() }
            }
            .buttonStyle(.borderedProminent)
        }
    }

    private var emptyEdition: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(store.isWriting ? "Out gathering" : "Nothing yet").font(.title2.weight(.semibold))
            Text(store.isWriting
                 ? "Poly is reading the news on your topics. Pull to refresh in a minute or two."
                 : "Your first edition arrives tomorrow at seven. Or Poly can write one now.")
                .foregroundStyle(.secondary)
            if !store.isWriting {
                Button("Write today's edition") {
                    Task { await store.writeNow() }
                }
                .buttonStyle(.borderedProminent)
            }
        }
    }

    @ViewBuilder
    private func topics(_ edition: DiscoverEdition) -> some View {
        let topics = edition.cards.filter { $0.kind == "topic" }

        if !topics.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                SectionTitle("Worth a look")
                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(topics) { card in
                        Button {
                            onStartConversation(card.chatPrompt)
                        } label: {
                            TopicTile(card: card, cover: card.coverId.flatMap { store.covers[$0] })
                        }
                        .buttonStyle(.plain)
                        .contextMenu { feedbackMenu(card) }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func stories(_ edition: DiscoverEdition) -> some View {
        let stories = edition.cards.filter { $0.kind != "topic" }

        if !stories.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                SectionTitle("For you")
                ForEach(stories) { card in
                    StoryRow(card: card) {
                        if card.kind == "read", let link = card.url.flatMap(URL.init(string:)) {
                            openURL(link)
                        } else {
                            onStartConversation(card.chatPrompt)
                        }
                    } onAsk: {
                        onStartConversation(card.chatPrompt)
                    }
                    .contextMenu { feedbackMenu(card) }
                }
            }
        }
    }

    @ViewBuilder
    private func feedbackMenu(_ card: DiscoverCard) -> some View {
        Button("Save", systemImage: "bookmark") { Task { await store.send("saved", for: card) } }
        if card.topic != nil {
            Button("More like this", systemImage: "hand.thumbsup") { Task { await store.send("more", for: card) } }
            Button("Less like this", systemImage: "hand.thumbsdown") { Task { await store.send("less", for: card) } }
            Button("Hide this topic", systemImage: "eye.slash", role: .destructive) {
                Task { await store.send("hide", for: card) }
            }
        }
    }
}

private struct SectionTitle: View {
    let title: String

    init(_ title: String) {
        self.title = title
    }

    var body: some View {
        Text(title.uppercased())
            .font(.caption.weight(.semibold))
            .tracking(0.8)
            .foregroundStyle(.secondary)
    }
}

private struct BriefCard: View {
    let edition: DiscoverEdition

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("From the perch").font(.system(.title2, design: .serif).weight(.medium))
            ForEach(edition.brief) { line in
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: line.systemImage)
                        .frame(width: 28, height: 28)
                        .background(Color.accentColor.opacity(0.15), in: RoundedRectangle(cornerRadius: 8))
                    (Text("\(line.label) · ").foregroundColor(.secondary) + Text(line.text).fontWeight(.medium))
                        .font(.subheadline)
                }
            }
            HStack(alignment: .bottom) {
                Text(edition.date).font(.system(.headline, design: .serif)).foregroundStyle(.secondary)
                Spacer()
                PetSpriteView(mood: .idle, size: 56)
            }
        }
        .padding(18)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 24))
    }
}

private struct TopicTile: View {
    let card: DiscoverCard
    let cover: UIImage?

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            if let cover {
                Image(uiImage: cover).resizable().scaledToFill()
            } else {
                LinearGradient(
                    colors: [Color.accentColor.opacity(0.9), Color.black],
                    startPoint: .topTrailing,
                    endPoint: .bottomLeading
                )
            }
            LinearGradient(colors: [.clear, .black.opacity(0.8)], startPoint: .center, endPoint: .bottom)
            VStack(alignment: .leading, spacing: 2) {
                Text((card.topic ?? "").uppercased())
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.75))
                Text(card.headline)
                    .font(.system(.subheadline, design: .serif).weight(.medium))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.leading)
            }
            .padding(10)
        }
        .aspectRatio(4.0 / 5.0, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .accessibilityElement(children: .combine)
    }
}

private struct StoryRow: View {
    let card: DiscoverCard
    let onOpen: () -> Void
    let onAsk: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(eyebrow).font(.caption).foregroundStyle(.secondary)
            Text(card.headline)
                .font(card.kind == "read" ? .system(.headline, design: .serif) : .headline)
            if let body = card.body {
                Text(body).font(.subheadline).foregroundStyle(.secondary).lineLimit(3)
            }
            HStack {
                Button(card.kind == "read" ? "Open" : card.kind == "check_in" ? "Reply" : "Start", action: onOpen)
                if card.kind == "read" {
                    Button("Ask about it", action: onAsk)
                }
            }
            .buttonStyle(.bordered)
            .font(.footnote)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 18))
    }

    private var eyebrow: String {
        switch card.kind {
        case "read": return "\(card.source ?? "Reading") · \(card.topic ?? "")"
        case "action": return card.when.map { "Worth doing · \($0)" } ?? "Worth doing"
        default: return "Checking in"
        }
    }
}
