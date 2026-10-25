import Foundation

struct ToolApprovalRequest: Equatable {
    let interactionId: String
    let toolName: String
    let message: String?
    let options: [String]
    let approvalRequired: Bool
    let resolution: String?
    let isResolved: Bool

    init?(data: JSONValue?) {
        guard let object = data?.objectValue,
              object["renderer"]?.stringValue == "approval_request",
              let approval = object["approval"]?.objectValue,
              let interactionId = approval["interactionId"]?.stringValue,
              let toolName = approval["toolName"]?.stringValue else {
            return nil
        }

        let humanInTheLoop = object["humanInTheLoop"]?.objectValue
        let options = object["options"].flatMap { value -> [String]? in
            guard case .array(let items) = value else { return nil }
            return items.compactMap(\.stringValue)
        } ?? []

        self.interactionId = interactionId
        self.toolName = toolName
        self.message = object["message"]?.stringValue
        self.options = options.isEmpty ? ["Approve", "Reject"] : options
        self.approvalRequired = object["approvalRequired"]?.boolValue == true
        self.resolution = object["resolution"]?.stringValue
            ?? humanInTheLoop?["resolution"]?.stringValue
        self.isResolved = object["resolved"]?.boolValue == true
            || approval["status"]?.stringValue == "resolved"
            || humanInTheLoop?["status"]?.stringValue == "resolved"
    }

    static let standingOption = "Always allow here"

    var isDirectResolution: Bool {
        approvalRequired || toolName == "request_approval"
    }

    func decision(for option: String) -> ToolApprovalDecision {
        let approves = option.lowercased() == "approve" || option == Self.standingOption
        return ToolApprovalDecision(
            interactionId: interactionId,
            toolName: toolName,
            option: option,
            resolution: approves ? "approved" : "rejected",
            approvalRequired: approvalRequired
        )
    }
}

struct ToolApprovalDecision: Equatable, Encodable {
    let interactionId: String
    let toolName: String
    let option: String
    let resolution: String
    let approvalRequired: Bool
}

struct ResponseInputRequest: Encodable {
    struct InteractionResponse: Encodable {
        struct Payload: Encodable {
            let option: String
            let interactionId: String
            let resolution: String
            let approvalRequired: Bool?
        }

        let type = "interaction_response"
        let toolName: String
        let response: Payload

        enum CodingKeys: String, CodingKey {
            case type, response
            case toolName = "tool_name"
        }
    }

    struct Client: Encodable {
        let platform = "mobile"
    }

    let input: [InteractionResponse]
    let stream = true
    let idempotencyKey: String
    let client = Client()

    enum CodingKeys: String, CodingKey {
        case input, stream, client
        case idempotencyKey = "idempotency_key"
    }

    init(decisions: [ToolApprovalDecision], idempotencyKey: String) {
        self.input = decisions.map { decision in
            InteractionResponse(
                toolName: decision.toolName,
                response: .init(
                    option: decision.option,
                    interactionId: decision.interactionId,
                    resolution: decision.resolution,
                    approvalRequired: decision.approvalRequired ? true : nil
                )
            )
        }
        self.idempotencyKey = idempotencyKey
    }
}
