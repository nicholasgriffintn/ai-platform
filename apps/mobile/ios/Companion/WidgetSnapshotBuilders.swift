import Foundation

extension WidgetSnapshot.Today {
    init(discover: DiscoverResponse) {
        let now = Date()
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: discover.dayProfile?.timezone ?? discover.settings.timezone ?? "") ?? .current
        let date = discover.now?.context.date ?? discover.edition?.date ?? ""
        let today = CalendarDate.string(from: now, calendar: calendar)
        let dayEnd = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now)) ?? now
        let observations = discover.settings.enabled ? discover.now?.observations.filter { !$0.isStale } ?? [] : []
        let brief: [WidgetSnapshot.Line]
        if !observations.isEmpty {
            brief = observations.prefix(4).map {
                WidgetSnapshot.Line(title: $0.text, detail: $0.source, systemImage: $0.kind == "travel" ? "tram" : $0.kind == "weather" ? "cloud.sun" : "calendar", expiresAt: AppDateParser.parse($0.expiresAt))
            }
        } else if discover.edition?.date == today {
            brief = discover.edition?.brief.prefix(4).map {
                WidgetSnapshot.Line(title: $0.text, detail: $0.label, systemImage: $0.systemImage, expiresAt: dayEnd)
            } ?? []
        } else {
            brief = []
        }
        let fresh = discover.feed?.items.filter { !$0.seen && !$0.dismissed && (AppDateParser.parse($0.expiresAt) ?? .distantPast) > now } ?? []
        let cards: [WidgetSnapshot.Line]
        if !fresh.isEmpty {
            cards = fresh.prefix(4).map {
                WidgetSnapshot.Line(title: $0.card.headline, detail: $0.card.topic ?? $0.card.source, systemImage: $0.card.systemImage, expiresAt: AppDateParser.parse($0.expiresAt))
            }
        } else if discover.edition?.date == today {
            cards = discover.edition?.cards.filter { discover.feed?.updatedAt == nil || !$0.isLiveFeedCard }.prefix(4).map {
                WidgetSnapshot.Line(title: $0.headline, detail: $0.topic ?? $0.source, systemImage: $0.systemImage, expiresAt: dayEnd)
            } ?? []
        } else {
            cards = []
        }
        self.init(date: date, greeting: discover.now?.title ?? discover.edition?.greeting ?? "Discover", brief: brief, cards: cards)
    }

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
            },
            pausedUntil: AppDateParser.parse(agenda.pausedUntil)
        )
    }
}
