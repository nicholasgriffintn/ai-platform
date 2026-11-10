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
            brief = observations.prefix(8).map {
                WidgetSnapshot.Line(
                    title: $0.startsAt == nil ? $0.text : $0.title,
                    detail: $0.source,
                    systemImage: WidgetSnapshot.Line.systemImage(forObservation: $0.kind),
                    expiresAt: AppDateParser.parse($0.expiresAt),
                    kind: $0.kind,
                    startsAt: AppDateParser.parse($0.startsAt),
                    endsAt: AppDateParser.parse($0.endsAt)
                )
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
        self.init(
            date: date,
            greeting: discover.now?.title ?? discover.edition?.greeting ?? "Discover",
            brief: brief,
            cards: cards,
            lines: discover.now?.lines?.map {
                WidgetSnapshot.LineStatus(id: $0.id, name: $0.name, status: $0.status, disrupted: $0.disrupted, reason: $0.reason, nearby: $0.nearby)
            },
            health: discover.now?.health.map(WidgetSnapshot.Health.init(summary:))
        )
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

extension WidgetSnapshot.Line {
    static func systemImage(forObservation kind: String) -> String {
        switch kind {
        case "travel", "lines": return "tram.fill"
        case "weather": return "cloud.sun"
        case "task": return "checklist"
        case "priority": return "bell.badge"
        default: return "calendar"
        }
    }
}

extension WidgetSnapshot.Health {
    init(summary: DiscoverHealthSummary) {
        self.init(
            sleepMinutes: summary.sleepMinutes,
            steps: summary.stepsToday,
            restingHeartRate: summary.restingHeartRate,
            restingHeartRateUsual: summary.restingHeartRateUsual,
            heartRateVariability: summary.heartRateVariability,
            heartRateVariabilityUsual: summary.heartRateVariabilityUsual,
            observedAt: AppDateParser.parse(summary.observedAt) ?? Date()
        )
    }
}
