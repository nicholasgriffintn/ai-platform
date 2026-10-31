import Foundation

struct ClientAnalyticsEvent: Encodable {
    let name: String
    let category: String
    let path: String?
    let properties: [String: String]?
}

struct ClientAnalyticsBatch: Encodable {
    let app: String
    let environment: String
    let appVersion: String?
    let sessionId: String
    let events: [ClientAnalyticsEvent]
}

struct ClientAnalyticsBatchResponse: Decodable {
    let accepted: Int
}
