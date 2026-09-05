import Foundation

struct OutputHistoryResponse: Codable, Equatable {
    let current: OutputRevision
    let revisions: [OutputRevision]
    let restore: OutputRestoreCapability
}

struct OutputRevision: Codable, Equatable, Identifiable {
    var id: Int { revision }

    let outputId: String
    let revision: Int
    let parentRevision: Int?
    let title: String
    let status: String
    let sensitivity: String
    let content: [String: JSONValue]
    let createdByUserId: Int
    let createdAt: String
    let operation: String
    let restoredFromRevision: Int?
    let provenance: OutputProvenance
}

struct OutputRestoreCapability: Codable, Equatable {
    let supported: Bool
    let reason: String?
    let fields: [String]
}

struct OutputProvenance: Codable, Equatable {
    let protocolVersion: Int
    let capturedAt: String
    let completeness: String
    let origin: String
    let run: OutputProvenanceRun?
    let model: OutputProvenanceModel?
    let skills: [OutputProvenanceSkill]
    let sources: [OutputProvenanceSource]
    let approvals: [OutputProvenanceApproval]
}

struct OutputProvenanceRun: Codable, Equatable {
    let id: String
    let attempt: Int
}

struct OutputProvenanceModel: Codable, Equatable {
    let id: String
    let provider: String
}

struct OutputProvenanceSkill: Codable, Equatable, Identifiable {
    let id: String
    let name: String
    let revisionId: String?
    let revision: Int?
}

struct OutputProvenanceSource: Codable, Equatable, Identifiable {
    let id: String
    let name: String?
    let state: String
}

struct OutputProvenanceApproval: Codable, Equatable, Identifiable {
    let id: String
    let type: String
    let status: String
    let toolName: String?
}

struct RestoreOutputRevisionRequest: Encodable {
    let expectedRevision: Int
}

struct RestoredOutputResponse: Decodable, Equatable {
    let id: String
    let revision: Int
    let title: String
}
