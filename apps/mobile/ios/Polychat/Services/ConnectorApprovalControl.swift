import Foundation

struct ConnectorApprovalControl: Equatable {
    let approval: ConnectorOperationApproval
    var submission: ProjectTaskInteractionSubmission

    var acceptsResolution: Bool {
        guard approval.state == "pending" else {
            return false
        }

        switch submission {
        case .idle:
            return true
        case .failed(_, let retryable):
            return retryable
        case .submitting, .acknowledged, .resolvedElsewhere:
            return false
        }
    }

    var canContinueApprovedOperation: Bool {
        approval.state == "approved" && submission != .submitting && submission != .acknowledged
    }

    static func reconcile(
        _ approval: ConnectorOperationApproval,
        previous: ConnectorApprovalControl?
    ) -> ConnectorApprovalControl {
        guard previous?.approval.id == approval.id else {
            return ConnectorApprovalControl(approval: approval, submission: .idle)
        }

        var submission = previous?.submission ?? .idle

        if previous?.approval.state == "pending" && approval.state != "pending" {
            submission = submission == .submitting || submission == .acknowledged
                ? .acknowledged
                : .resolvedElsewhere
        }

        return ConnectorApprovalControl(approval: approval, submission: submission)
    }
}
