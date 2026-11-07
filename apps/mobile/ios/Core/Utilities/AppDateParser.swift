import Foundation

enum AppDateParser {
    private static let fractionalISO8601Formatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let iso8601Formatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    private static let sqliteFormatters: [DateFormatter] = [
        "yyyy-MM-dd HH:mm:ss.SSS",
        "yyyy-MM-dd HH:mm:ss",
        "yyyy-MM-dd'T'HH:mm:ss.SSS",
        "yyyy-MM-dd'T'HH:mm:ss"
    ].map { format in
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = format
        return formatter
    }

    static func parse(_ value: String?) -> Date? {
        guard let value else {
            return nil
        }

        let trimmedValue = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedValue.isEmpty else {
            return nil
        }

        if let date = parseISO8601(trimmedValue) {
            return date
        }

        return parseSQLiteTimestamp(trimmedValue)
    }

    static func parse(_ value: String?, fallback: @autoclosure () -> Date) -> Date {
        parse(value) ?? fallback()
    }

    private static func parseISO8601(_ value: String) -> Date? {
        fractionalISO8601Formatter.date(from: value) ?? iso8601Formatter.date(from: value)
    }

    private static func parseSQLiteTimestamp(_ value: String) -> Date? {
        for formatter in sqliteFormatters {
            if let date = formatter.date(from: value) {
                return date
            }
        }

        return nil
    }
}
