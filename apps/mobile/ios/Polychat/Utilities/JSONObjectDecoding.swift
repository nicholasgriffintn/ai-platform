import Foundation

enum JSONObjectDecoding {
    static func decode<T: Decodable>(_ type: T.Type, from object: Any) -> T? {
        guard let data = try? JSONSerialization.data(withJSONObject: object, options: [.fragmentsAllowed]) else {
            return nil
        }

        return try? JSONDecoder().decode(type, from: data)
    }

    static func decode<T: Decodable>(_ type: T.Type, fromJSONString string: String) -> T? {
        guard let data = string.data(using: .utf8) else {
            return nil
        }

        return try? JSONDecoder().decode(type, from: data)
    }
}
