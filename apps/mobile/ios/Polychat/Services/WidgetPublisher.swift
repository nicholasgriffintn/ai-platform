import Foundation
import WidgetKit

enum WidgetPublisher {
    static func publish(edition: DiscoverEdition?) {
        write { $0.today = edition.map(WidgetSnapshot.Today.init(edition:)) }
    }

    static func publish(attention items: [WorkAttentionItem], needsYou: Int, running: Int) {
        write { $0.attention = WidgetSnapshot.Attention(items: items, needsYou: needsYou, running: running) }
    }

    static func publish(agenda: PolyAgenda?) {
        write { $0.poly = agenda.map(WidgetSnapshot.Poly.init(agenda:)) }
    }

    static func clear() {
        WidgetSnapshotStore.clear()
        WidgetCenter.shared.reloadAllTimelines()
        WatchBridge.shared.publish(.empty)
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
        WatchBridge.shared.publish(WidgetSnapshotStore.read())
    }
}
