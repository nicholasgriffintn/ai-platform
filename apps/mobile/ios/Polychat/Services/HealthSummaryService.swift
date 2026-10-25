import Foundation
import HealthKit

@MainActor
final class HealthSummaryService {
    static let shared = HealthSummaryService()

    private let store = HKHealthStore()
    private let sleep = HKCategoryType(.sleepAnalysis)
    private let mindful = HKCategoryType(.mindfulSession)
    private let exercise = HKQuantityType(.appleExerciseTime)

    var isAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

    func requestAccess() async throws {
        try await store.requestAuthorization(toShare: [], read: [sleep, mindful, exercise])
    }

    func yesterday(calendar: Calendar = .current, now: Date = Date()) async throws -> DiscoverHealthSummary {
        let today = calendar.startOfDay(for: now)
        let yesterday = calendar.date(byAdding: .day, value: -1, to: today) ?? today
        let sleepStart = calendar.date(byAdding: .hour, value: 18, to: yesterday) ?? yesterday
        let sleepEnd = calendar.date(byAdding: .hour, value: 12, to: today) ?? today
        let formatter = DateFormatter()

        formatter.calendar = calendar
        formatter.dateFormat = "yyyy-MM-dd"

        return DiscoverHealthSummary(
            date: formatter.string(from: yesterday),
            sleepMinutes: try await minutes(of: sleep, from: sleepStart, to: sleepEnd, asleepOnly: true),
            mindfulMinutes: try await minutes(of: mindful, from: yesterday, to: today, asleepOnly: false),
            exerciseMinutes: try await exerciseMinutes(from: yesterday, to: today)
        )
    }

    private func minutes(
        of type: HKCategoryType,
        from start: Date,
        to end: Date,
        asleepOnly: Bool
    ) async throws -> Int? {
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end)
        let descriptor = HKSampleQueryDescriptor(
            predicates: [.categorySample(type: type, predicate: predicate)],
            sortDescriptors: []
        )
        let samples = try await descriptor.result(for: store)
        let counted = asleepOnly
            ? samples.filter { HKCategoryValueSleepAnalysis.allAsleepValues.map(\.rawValue).contains($0.value) }
            : samples

        guard !counted.isEmpty else { return nil }

        let seconds = DateIntervals.coveredSeconds(counted.map { ($0.startDate, $0.endDate) })
        return min(1440, Int((seconds / 60).rounded()))
    }

    private func exerciseMinutes(from start: Date, to end: Date) async throws -> Int? {
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end)
        let descriptor = HKStatisticsQueryDescriptor(
            predicate: .quantitySample(type: exercise, predicate: predicate),
            options: .cumulativeSum
        )
        let total = try await descriptor.result(for: store)?.sumQuantity()

        return total.map { min(1440, Int($0.doubleValue(for: .minute()).rounded())) }
    }
}
