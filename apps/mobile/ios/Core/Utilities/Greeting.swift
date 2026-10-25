import Foundation

enum Greeting {
    static func text(name: String?, at date: Date = Date(), calendar: Calendar = .current) -> String {
        let hour = calendar.component(.hour, from: date)
        let opener = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
        guard let first = name?.split(separator: " ").first else {
            return opener
        }
        return "\(opener), \(first)"
    }
}
