import Foundation

enum AgeGateStatus: String, Codable, Equatable {
    case notRequired = "not_required"
    case pending
    case adult
    case underAge = "under_age"

    var allowsSending: Bool {
        self == .notRequired || self == .adult
    }
}

struct AgeGateResponse: Codable, Equatable {
    let status: AgeGateStatus
}

struct AgeConfirmationRequest: Encodable {
    let birthDate: String

    enum CodingKeys: String, CodingKey {
        case birthDate = "birth_date"
    }
}
