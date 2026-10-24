import Foundation
import WidgetKit

enum WidgetPublisher {
    static func publish(edition: DiscoverEdition?) {
        let today = edition.map { edition in
            WidgetSnapshot.Today(
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
        write { $0.today = today }
    }

    static func publish(attention items: [WorkAttentionItem], needsYou: Int, running: Int) {
        let lines = items.prefix(5).map {
            WidgetSnapshot.Line(title: $0.title, detail: $0.projectName, systemImage: $0.needsAction ? "exclamationmark.circle" : "bolt.horizontal")
        }
        write { $0.attention = WidgetSnapshot.Attention(needsYou: needsYou, running: running, items: lines) }
    }

    static func publish(agenda: PolyAgenda?) {
        let poly = agenda.map { agenda in
            let presence = PolyPresence.derive(from: agenda)
            return WidgetSnapshot.Poly(
                status: presence.status,
                needsYou: agenda.needsYou.count,
                workingOn: agenda.workingOn.count,
                items: (agenda.needsYou + agenda.workingOn).prefix(4).map {
                    WidgetSnapshot.Line(title: $0.title, detail: $0.status, systemImage: "circle.fill")
                }
            )
        }
        write { $0.poly = poly }
    }

    static func clear() {
        WidgetSnapshotStore.clear()
        WidgetCenter.shared.reloadAllTimelines()
    }

    private static func write(_ change: (inout WidgetSnapshot) -> Void) {
        let before = WidgetSnapshotStore.read()
        var after = before
        change(&after)
        guard after.today != before.today || after.attention != before.attention || after.poly != before.poly else {
            return
        }
        WidgetSnapshotStore.update(change)
        WidgetCenter.shared.reloadAllTimelines()
    }
}
