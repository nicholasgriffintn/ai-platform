import Foundation

struct DeviceActivity: Encodable, Equatable {
    struct Source: Encodable, Equatable {
        let source: String
        let lines: [String]
    }

    let label: String
    let periodStart: String
    let periodEnd: String
    let sources: [Source]
}

struct DeviceActivityResponse: Decodable {
    let recorded: [String]
    let excluded: [String]
}
