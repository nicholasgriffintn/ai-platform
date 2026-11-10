import Foundation
import UIKit

@MainActor
enum PhoneActivitySync {
    private static let calendarKey = "phoneActivity.calendar"
    private static let digestKey = "phoneActivity.digest"
    private static let sentAtKey = "phoneActivity.sentAt"
    private static let resendInterval: TimeInterval = 20 * 60
    private static let lineLimit = 40
    private static let lineLength = 280

    static var machineId: String {
        "iphone-\(UIDevice.current.identifierForVendor?.uuidString.lowercased() ?? "device")"
    }

    static var syncsCalendar: Bool {
        get { UserDefaults.standard.bool(forKey: calendarKey) }
        set { UserDefaults.standard.set(newValue, forKey: calendarKey) }
    }

    static func sync(client: APIClient, force: Bool = false, now: Date = Date()) async {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: now)
        let weekAhead = calendar.date(byAdding: .day, value: 7, to: today) ?? now
        let events = PhoneCalendar.events(from: today, to: weekAhead)
        var sources: [DeviceActivity.Source] = []

        if PhoneCalendar.isAuthorized, syncsCalendar {
            sources.append(.init(source: "calendar", lines: limit(events.isEmpty ? ["No events in the next seven days"] : events.map(\.activityLine))))
        }

        let digest = sources.map { "\($0.source):\($0.lines.joined(separator: "|"))" }.joined(separator: "\n")
        let sentAt = Date(timeIntervalSince1970: UserDefaults.standard.double(forKey: sentAtKey))
        if !force, digest == UserDefaults.standard.string(forKey: digestKey), now.timeIntervalSince(sentAt) < resendInterval {
            return
        }

        let formatter = ISO8601DateFormatter()
        let activity = DeviceActivity(
            label: "iPhone",
            periodStart: formatter.string(from: today),
            periodEnd: formatter.string(from: now),
            sources: sources
        )

        do {
            _ = try await client.shareDeviceActivity(machineId: machineId, activity)
            UserDefaults.standard.set(digest, forKey: digestKey)
            UserDefaults.standard.set(now.timeIntervalSince1970, forKey: sentAtKey)
        } catch {
            return
        }
    }

    static func reset() {
        UserDefaults.standard.removeObject(forKey: calendarKey)
        UserDefaults.standard.removeObject(forKey: digestKey)
        UserDefaults.standard.removeObject(forKey: sentAtKey)
    }

    private static func limit(_ lines: [String]) -> [String] {
        lines.prefix(lineLimit).map { String($0.prefix(lineLength)) }
    }
}

private extension PhoneEvent {
    private static let dayFormatter = fixedFormatter("yyyy-MM-dd")
    private static let timeFormatter = fixedFormatter("HH:mm")

    private static func fixedFormatter(_ format: String) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = format
        return formatter
    }

    var activityLine: String {
        let day = Self.dayFormatter.string(from: start)
        let time = isAllDay
            ? "all day"
            : "\(Self.timeFormatter.string(from: start))–\(Self.timeFormatter.string(from: end))"
        return ["\(day) \(time)", title, location].compactMap { $0 }.joined(separator: " · ")
    }
}
