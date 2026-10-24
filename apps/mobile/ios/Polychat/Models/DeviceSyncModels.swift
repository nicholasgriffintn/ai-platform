import Foundation

struct DeviceSyncGrantRequest: Encodable {
    let deviceId: String
}

struct DeviceSyncGrant: Decodable {
    let token: String
    let expiresAt: Int
    let socketUrl: String
}

struct DeviceSyncEvent: Equatable {
    let topic: String
    let seq: Int
    let type: String
    let originDeviceId: String?
    let data: [String: JSONValue]

    func string(_ key: String) -> String? {
        data[key]?.stringValue
    }
}

enum DeviceSyncServerMessage {
    case event(DeviceSyncEvent)
    case subscribed(topic: String, seq: Int)
    case reset(topic: String, seq: Int)
    case other

    init(json: Data) {
        guard let object = try? JSONDecoder().decode([String: JSONValue].self, from: json),
              let type = object["type"]?.stringValue else {
            self = .other
            return
        }

        switch type {
        case "event":
            guard let event = object["event"]?.objectValue,
                  let topic = event["topic"]?.stringValue,
                  let seq = event["seq"]?.intValue,
                  let eventType = event["type"]?.stringValue else {
                self = .other
                return
            }
            self = .event(DeviceSyncEvent(
                topic: topic,
                seq: seq,
                type: eventType,
                originDeviceId: event["originDeviceId"]?.stringValue,
                data: event["data"]?.objectValue ?? [:]
            ))
        case "subscribed":
            self = .subscribed(topic: object["topic"]?.stringValue ?? "", seq: object["seq"]?.intValue ?? 0)
        case "reset":
            self = .reset(topic: object["topic"]?.stringValue ?? "", seq: object["seq"]?.intValue ?? 0)
        default:
            self = .other
        }
    }
}

struct DeviceSyncSubscription: Encodable {
    let topic: String
    let lastSeq: Int?
}

enum DeviceSyncClientMessage: Encodable {
    case subscribe([DeviceSyncSubscription])
    case unsubscribe([String])
    case focus(String?)
    case ping

    private enum CodingKeys: String, CodingKey {
        case type, topics, topic
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .subscribe(let topics):
            try container.encode("subscribe", forKey: .type)
            try container.encode(topics, forKey: .topics)
        case .unsubscribe(let topics):
            try container.encode("unsubscribe", forKey: .type)
            try container.encode(topics, forKey: .topics)
        case .focus(let topic):
            try container.encode("focus", forKey: .type)
            try container.encode(topic, forKey: .topic)
        case .ping:
            try container.encode("ping", forKey: .type)
        }
    }
}
