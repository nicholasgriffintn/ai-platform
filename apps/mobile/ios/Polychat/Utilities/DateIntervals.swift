import Foundation

enum DateIntervals {
    static func coveredSeconds(_ intervals: [(start: Date, end: Date)]) -> TimeInterval {
        let sorted = intervals.filter { $0.end > $0.start }.sorted { $0.start < $1.start }
        var total: TimeInterval = 0
        var current: (start: Date, end: Date)?

        for interval in sorted {
            if let open = current, interval.start <= open.end {
                current = (open.start, max(open.end, interval.end))
            } else {
                if let open = current {
                    total += open.end.timeIntervalSince(open.start)
                }
                current = interval
            }
        }

        if let open = current {
            total += open.end.timeIntervalSince(open.start)
        }
        return total
    }
}
