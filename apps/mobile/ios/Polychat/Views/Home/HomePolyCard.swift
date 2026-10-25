import SwiftUI

struct HomePolyCard: View {
    let agenda: PolyAgenda
    let onOpen: (String) -> Void

    private static let itemLimit = 3

    var body: some View {
        let presence = PolyPresence.derive(from: agenda)

        VStack(alignment: .leading, spacing: 12) {
            Button {
                onOpen(agenda.conversationId)
            } label: {
                HStack(spacing: 10) {
                    PolyMark(size: 28)
                    Text(presence.status)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.polychat.text)
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.polychat.textMuted)
                }
            }
            .buttonStyle(.plain)

            section("Needs you", items: agenda.needsYou, systemImage: "bell.badge")
            section("Working on", items: agenda.workingOn, systemImage: "hammer")
            section("Noted", items: agenda.noted, systemImage: "bookmark")
        }
        .polychatCard()
    }

    @ViewBuilder
    private func section(_ title: String, items: [PolyAgendaItem], systemImage: String) -> some View {
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                EyebrowLabel(title)
                ForEach(items.prefix(Self.itemLimit)) { item in
                    Button {
                        onOpen(item.conversationId)
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: systemImage)
                                .font(.caption)
                                .foregroundStyle(Color.polychat.primary)
                                .frame(width: 18)
                            Text(item.title)
                                .font(.subheadline)
                                .foregroundStyle(Color.polychat.text)
                                .lineLimit(1)
                            Spacer(minLength: 0)
                        }
                    }
                    .buttonStyle(.plain)
                }
                if items.count > Self.itemLimit {
                    Text("and \(items.count - Self.itemLimit) more")
                        .font(.caption)
                        .foregroundStyle(Color.polychat.textMuted)
                }
            }
        }
    }
}
