import EventKit
import Foundation

struct NowEvent: Hashable {
    let title: String
    let start: Date
    let end: Date
    let location: String?
}

enum NowCalendar {
    static func upcoming(now: Date = Date(), limit: Int = 3) -> [NowEvent] {
        guard WidgetPreferences.showsCalendar,
              EKEventStore.authorizationStatus(for: .event) == .fullAccess else {
            return []
        }
        let store = EKEventStore()
        let horizon = now.addingTimeInterval(18 * 60 * 60)
        let predicate = store.predicateForEvents(withStart: now, end: horizon, calendars: nil)

        return store.events(matching: predicate)
            .filter { event in
                !event.isAllDay
                    && event.status != .canceled
                    && event.endDate > now
                    && event.attendees?.first(where: \.isCurrentUser)?.participantStatus != .declined
            }
            .sorted { $0.startDate < $1.startDate }
            .prefix(limit)
            .map { event in
                let title = event.title ?? ""
                return NowEvent(
                    title: title.isEmpty ? "Busy" : title,
                    start: event.startDate,
                    end: event.endDate,
                    location: event.location?.isEmpty == false ? event.location : nil
                )
            }
    }
}
