import Foundation

enum MoonPhase {
    private static let synodicDays = 29.530588853
    private static let knownNewMoon = Date(timeIntervalSince1970: 947_182_440)

    static func fraction(at date: Date) -> Double {
        let cycles = date.timeIntervalSince(knownNewMoon) / 86_400 / synodicDays
        return cycles - cycles.rounded(.down)
    }
}
