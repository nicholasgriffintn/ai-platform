import Foundation

enum ClockTime {
    static func date(from value: String, calendar: Calendar = .current) -> Date {
        let parts = value.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2, (0...23).contains(parts[0]), (0...59).contains(parts[1]) else {
            return calendar.startOfDay(for: Date())
        }
        return calendar.date(from: DateComponents(year: 2001, month: 1, day: 1, hour: parts[0], minute: parts[1]))
            ?? calendar.startOfDay(for: Date())
    }

    static func string(from date: Date, calendar: Calendar = .current) -> String {
        let parts = calendar.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", parts.hour ?? 0, parts.minute ?? 0)
    }
}
