import Foundation
import HealthKit

@MainActor
final class HealthSummaryService {
    static let shared = HealthSummaryService()

    private let store = HKHealthStore()
    private let sleep = HKCategoryType(.sleepAnalysis)
    private let mindful = HKCategoryType(.mindfulSession)
    private let exercise = HKQuantityType(.appleExerciseTime)
    private let steps = HKQuantityType(.stepCount)
    private let restingHeartRate = HKQuantityType(.restingHeartRate)
    private let heartRateVariability = HKQuantityType(.heartRateVariabilitySDNN)

    var isAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

    func requestAccess() async throws {
        try await store.requestAuthorization(toShare: [], read: [sleep, mindful, exercise])
    }

    func requestVitalsAccess() async throws {
        try await store.requestAuthorization(toShare: [], read: [sleep, steps, restingHeartRate, heartRateVariability])
    }

    func vitals(calendar: Calendar = .current, now: Date = Date()) async throws -> WidgetSnapshot.Health {
        let today = calendar.startOfDay(for: now)
        let yesterday = calendar.date(byAdding: .day, value: -1, to: today) ?? today
        let sleepStart = calendar.date(byAdding: .hour, value: 18, to: yesterday) ?? yesterday
        let sleepEnd = calendar.date(byAdding: .hour, value: 12, to: today) ?? today
        let recent = now.addingTimeInterval(-36 * 60 * 60)
        let usualStart = calendar.date(byAdding: .day, value: -28, to: today) ?? today
        let beatsPerMinute = HKUnit.count().unitDivided(by: .minute())
        let milliseconds = HKUnit.secondUnit(with: .milli)

        return WidgetSnapshot.Health(
            sleepMinutes: try await minutes(of: sleep, from: sleepStart, to: min(sleepEnd, now), asleepOnly: true),
            steps: try await total(of: steps, unit: .count(), from: today, to: now),
            restingHeartRate: try await latest(of: restingHeartRate, unit: beatsPerMinute, since: recent),
            restingHeartRateUsual: try await average(of: restingHeartRate, unit: beatsPerMinute, from: usualStart, to: today),
            heartRateVariability: try await latest(of: heartRateVariability, unit: milliseconds, since: recent),
            heartRateVariabilityUsual: try await average(of: heartRateVariability, unit: milliseconds, from: usualStart, to: today),
            observedAt: now
        )
    }

    private func total(of type: HKQuantityType, unit: HKUnit, from start: Date, to end: Date) async throws -> Int? {
        let descriptor = HKStatisticsQueryDescriptor(
            predicate: .quantitySample(type: type, predicate: HKQuery.predicateForSamples(withStart: start, end: end)),
            options: .cumulativeSum
        )
        return try await descriptor.result(for: store)?.sumQuantity().map { Int($0.doubleValue(for: unit).rounded()) }
    }

    private func average(of type: HKQuantityType, unit: HKUnit, from start: Date, to end: Date) async throws -> Int? {
        let descriptor = HKStatisticsQueryDescriptor(
            predicate: .quantitySample(type: type, predicate: HKQuery.predicateForSamples(withStart: start, end: end)),
            options: .discreteAverage
        )
        return try await descriptor.result(for: store)?.averageQuantity().map { Int($0.doubleValue(for: unit).rounded()) }
    }

    private func latest(of type: HKQuantityType, unit: HKUnit, since start: Date) async throws -> Int? {
        let descriptor = HKSampleQueryDescriptor(
            predicates: [.quantitySample(type: type, predicate: HKQuery.predicateForSamples(withStart: start, end: nil))],
            sortDescriptors: [SortDescriptor(\.endDate, order: .reverse)],
            limit: 1
        )
        return try await descriptor.result(for: store).first.map { Int($0.quantity.doubleValue(for: unit).rounded()) }
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
