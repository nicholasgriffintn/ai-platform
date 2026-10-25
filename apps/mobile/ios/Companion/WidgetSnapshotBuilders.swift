import Foundation

extension WidgetSnapshot.Today {
    init(edition: DiscoverEdition) {
        self.init(
            date: edition.date,
            greeting: edition.greeting,
            brief: edition.brief.prefix(4).map {
                WidgetSnapshot.Line(title: $0.text, detail: $0.label, systemImage: $0.systemImage)
            },
            cards: edition.cards.prefix(4).map {
                WidgetSnapshot.Line(title: $0.headline, detail: $0.topic ?? $0.source, systemImage: $0.systemImage)
            }
        )
    }
}

extension WidgetSnapshot.Attention {
    init(items: [WorkAttentionItem], needsYou: Int, running: Int) {
        self.init(
            needsYou: needsYou,
            running: running,
            items: items.prefix(5).map {
                WidgetSnapshot.Line(
                    title: $0.title,
                    detail: $0.projectName,
                    systemImage: $0.needsAction ? "exclamationmark.circle" : "bolt.horizontal"
                )
            }
        )
    }
}

extension WidgetSnapshot.Poly {
    init(agenda: PolyAgenda) {
        self.init(
            status: PolyPresence.derive(from: agenda).status,
            needsYou: agenda.needsYou.count,
            workingOn: agenda.workingOn.count,
            items: (agenda.needsYou + agenda.workingOn).prefix(4).map {
                WidgetSnapshot.Line(title: $0.title, detail: $0.status, systemImage: "circle.fill")
            }
        )
    }
}
