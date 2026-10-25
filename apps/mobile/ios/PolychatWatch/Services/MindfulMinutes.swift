import HealthKit

enum MindfulMinutes {
    private static let minimumSeconds: TimeInterval = 60
    private static let store = HKHealthStore()

    static func save(from start: Date, to end: Date) async -> String? {
        guard end.timeIntervalSince(start) >= minimumSeconds, HKHealthStore.isHealthDataAvailable() else {
            return nil
        }
        let type = HKCategoryType(.mindfulSession)

        do {
            try await store.requestAuthorization(toShare: [type], read: [])
            try await store.save(HKCategorySample(
                type: type,
                value: HKCategoryValue.notApplicable.rawValue,
                start: start,
                end: end
            ))
            return "Saved to Health as mindful minutes."
        } catch {
            return "Health did not take it: \(error.localizedDescription)"
        }
    }
}
