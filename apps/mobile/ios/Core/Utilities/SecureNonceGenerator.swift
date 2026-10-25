import CryptoKit
import Foundation
import Security

enum SecureNonceGenerator {
    enum NonceError: LocalizedError {
        case unableToGenerateRandomBytes

        var errorDescription: String? {
            "Unable to generate secure random bytes."
        }
    }

    static func randomString(length: Int = 32) throws -> String {
        precondition(length > 0)
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remainingLength = length

        while remainingLength > 0 {
            var randomByte: UInt8 = 0
            let status = SecRandomCopyBytes(kSecRandomDefault, 1, &randomByte)
            guard status == errSecSuccess else {
                throw NonceError.unableToGenerateRandomBytes
            }

            if Int(randomByte) < charset.count {
                result.append(charset[Int(randomByte)])
                remainingLength -= 1
            }
        }

        return result
    }
}

enum SHA256Hasher {
    static func hexDigest(_ input: String) -> String {
        let inputData = Data(input.utf8)
        let hashedData = SHA256.hash(data: inputData)
        return hashedData.map { String(format: "%02x", $0) }.joined()
    }
}
