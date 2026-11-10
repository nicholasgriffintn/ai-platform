import Foundation

extension DiscoverDayProfile {
    var weekSummary: String {
        let office = week.filter { $0.mode == .office }.count
        let remote = week.filter { $0.mode == .remote }.count
        let parts = [office > 0 ? "\(office) office" : nil, remote > 0 ? "\(remote) at home" : nil].compactMap { $0 }
        return parts.isEmpty ? "No working days" : parts.joined(separator: " · ")
    }

    var audioSummary: String {
        let parts = [
            audio.morning.enabled ? "Morning \(audio.morning.time)" : nil,
            audio.evening.enabled ? "Evening \(audio.evening.time)" : nil
        ].compactMap { $0 }
        return parts.isEmpty ? "Off" : parts.joined(separator: " · ")
    }

    var lineStatusSummary: String {
        guard let lineStatus, lineStatus.enabled else { return "Off" }
        let count = lineStatus.lines.count
        let parts = [
            count > 0 ? "\(count) \(count == 1 ? "line" : "lines")" : nil,
            lineStatus.nearby ? "Nearby" : nil
        ].compactMap { $0 }
        return parts.isEmpty ? "No lines chosen" : parts.joined(separator: " · ")
    }

    var alertSummary: String {
        notifications.enabled && notifications.dailyLimit > 0 ? "Up to \(notifications.dailyLimit) a day" : "Off"
    }
}
