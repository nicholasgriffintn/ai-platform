import EventKit
import Foundation

struct PhoneEvent: Hashable {
    let title: String
    let start: Date
    let end: Date
    let location: String?
    let isAllDay: Bool
}

enum PhoneCalendar {
    static var isAuthorized: Bool {
        EKEventStore.authorizationStatus(for: .event) == .fullAccess
    }

    static func events(from start: Date, to end: Date) -> [PhoneEvent] {
        guard isAuthorized else { return [] }
        let store = EKEventStore()
        let predicate = store.predicateForEvents(withStart: start, end: end, calendars: nil)

        return store.events(matching: predicate)
            .filter { event in
                event.status != .canceled
                    && event.attendees?.first(where: \.isCurrentUser)?.participantStatus != .declined
            }
            .sorted { $0.startDate < $1.startDate }
            .map { event in
                let title = event.title ?? ""
                let location = event.location ?? ""
                return PhoneEvent(
                    title: title.isEmpty ? "Busy" : title,
                    start: event.startDate,
                    end: event.endDate,
                    location: location.isEmpty ? nil : location,
                    isAllDay: event.isAllDay
                )
            }
    }
}
