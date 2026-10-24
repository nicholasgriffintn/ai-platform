import Foundation

enum RelativeTime {
    static func label(for value: String?, now: Date = Date()) -> String {
        guard let date = AppDateParser.parse(value) else {
            return ""
        }
        return label(for: date, now: now)
    }

    static func label(for date: Date, now: Date = Date()) -> String {
        if now.timeIntervalSince(date) < 60 {
            return "Just now"
        }

        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: now)
    }
}
