import Foundation

enum DeviceIdentity {
    private static let key = "polychat.deviceId"

    static let id: String = {
        if let existing = UserDefaults.standard.string(forKey: key) {
            return existing
        }
        let created = "ios-\(UUID().uuidString.lowercased())"
        UserDefaults.standard.set(created, forKey: key)
        return created
    }()
}
