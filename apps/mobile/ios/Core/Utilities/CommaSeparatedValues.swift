import Foundation

enum CommaSeparatedValues {
    static func parse(_ value: String) -> [String] {
        var seen = Set<String>()
        return value.split(separator: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty && seen.insert($0.lowercased()).inserted }
    }
}
