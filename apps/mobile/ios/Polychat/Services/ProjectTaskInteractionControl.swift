import Foundation

enum ProjectTaskInteractionSubmission: Equatable {
    case idle
    case submitting
    case failed(message: String, retryable: Bool)
    case acknowledged
    case resolvedElsewhere
}

struct ProjectTaskInteractionControl: Equatable {
    let task: ProjectTaskControlTask
    let interaction: ProjectTaskInteraction
    var submission: ProjectTaskInteractionSubmission

    var destination: ProjectTaskDestination {
        ProjectTaskDestination(
            workspaceId: task.workspaceId,
            projectId: task.projectId,
            taskId: task.id,
            conversationId: task.conversationId
        )
    }

    var acceptsSubmission: Bool {
        guard interaction.isPending && interaction.isSupported else {
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

    static func reconcile(
        _ detail: ProjectTaskDetailResponse,
        previous: ProjectTaskInteractionControl?
    ) -> ProjectTaskInteractionControl? {
        guard let interaction = detail.interaction else {
            return nil
        }

        guard previous?.interaction.interactionId == interaction.interactionId else {
            return ProjectTaskInteractionControl(task: detail.task, interaction: interaction, submission: .idle)
        }

        var submission = previous?.submission ?? .idle

        if previous?.interaction.isPending == true && !interaction.isPending {
            submission = submission == .submitting || submission == .acknowledged
                ? .acknowledged
                : .resolvedElsewhere
        } else if interaction.isPending,
                  submission == .acknowledged || submission == .resolvedElsewhere {
            submission = .idle
        }

        return ProjectTaskInteractionControl(
            task: detail.task,
            interaction: interaction,
            submission: submission
        )
    }
}
