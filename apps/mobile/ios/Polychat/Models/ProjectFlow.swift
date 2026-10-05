import Foundation

struct ProjectFlow: Codable, Equatable {
    let version: Int
    let entryNodeId: String
    let nodes: [ProjectFlowNode]
    let maxSteps: Int
}

struct ProjectFlowNode: Codable, Equatable, Identifiable {
    let id: String
    let name: String
    let type: String
    let prompt: String?
    let fields: [NativeRecordColumn]?
}

struct NativeRecordColumn: Codable, Equatable, Identifiable {
    let id: String
    let name: String
    let type: String
    let required: Bool
    let maxLength: Int?
    let minimum: Double?
    let maximum: Double?
    let options: [String]?
}

struct ProjectFlowExecution: Codable, Equatable {
    let epoch: Int
    let nodeId: String
    let steps: Int
    let iterations: [String: Int]
    let values: [String: JSONValue]
    let waitId: String?
}

struct ProjectFlowWait: Codable, Equatable, Identifiable {
    let id: String
    let taskId: String
    let nodeId: String
    let kind: String
    let status: String
    let revision: Int
    let assignedUserId: Int?
    let dueAt: String?
    let error: String?
}

struct ResolveProjectFlowWaitRequest: Encodable {
    let expectedRevision: Int
    let resolution: String
    let values: [String: JSONValue]
}

struct ProjectFlowEvent: Codable, Equatable, Identifiable {
    var id: Int { sequence }
    let sequence: Int
    let taskId: String
    let nodeId: String
    let epoch: Int
    let step: Int
    let kind: String
    let waitId: String?
    let detail: String?
    let createdAt: String
}

struct ProjectFlowHistory: Codable, Equatable {
    let events: [ProjectFlowEvent]
    let nextCursor: Int
    let hasMore: Bool
}
