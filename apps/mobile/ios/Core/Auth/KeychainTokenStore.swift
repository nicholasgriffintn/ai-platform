import Foundation
import Security

struct StoredAuthToken: Codable {
    let value: String
    let expiresAt: Date

    var isUsable: Bool {
        Date() < expiresAt.addingTimeInterval(-120)
    }
}

final class KeychainTokenStore {
    static let shared = KeychainTokenStore()

    private let service = "com.polychat-app.app.auth"
    private let account = "bearer-token"

    private init() {}

    func save(_ token: StoredAuthToken) throws {
        let data = try JSONEncoder().encode(token)
        let query = baseQuery()

        SecItemDelete(query as CFDictionary)

        var attributes = query
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly

        let status = SecItemAdd(attributes as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainError.unhandledStatus(status)
        }
    }

    func load() throws -> StoredAuthToken? {
        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        if status == errSecItemNotFound {
            return nil
        }

        guard status == errSecSuccess else {
            throw KeychainError.unhandledStatus(status)
        }

        guard let data = result as? Data else {
            throw KeychainError.invalidData
        }

        return try JSONDecoder().decode(StoredAuthToken.self, from: data)
    }

    func clear() {
        SecItemDelete(baseQuery() as CFDictionary)
    }

    private func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }
}

enum KeychainError: LocalizedError {
    case invalidData
    case unhandledStatus(OSStatus)

    var errorDescription: String? {
        switch self {
        case .invalidData:
            return "Stored authentication data is invalid."
        case .unhandledStatus(let status):
            return "Keychain operation failed with status \(status)."
        }
    }
}
