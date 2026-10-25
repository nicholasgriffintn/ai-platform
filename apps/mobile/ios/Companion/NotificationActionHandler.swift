import Foundation
import UserNotifications

extension MobileWorkTarget {
    init?(notificationPayload userInfo: [AnyHashable: Any]) {
        guard let polychat = userInfo["polychat"] as? [String: Any],
              let target = polychat["target"] as? [String: Any],
              let workspaceId = target["workspaceId"] as? String,
              let projectId = target["projectId"] as? String else {
            return nil
        }

        self.init(
            workspaceId: workspaceId,
            projectId: projectId,
            conversationId: target["conversationId"] as? String,
            taskId: target["taskId"] as? String,
            runId: target["runId"] as? String,
            interactionId: target["interactionId"] as? String
        )
    }
}

enum NotificationActionError: LocalizedError {
    case needsApp(String)

    var errorDescription: String? {
        switch self {
        case .needsApp(let reason):
            return reason
        }
    }
}

@MainActor
enum NotificationActionHandler {
    static func handles(_ actionIdentifier: String) -> Bool {
        NotificationAction.all.contains(actionIdentifier)
    }

    static func perform(_ response: UNNotificationResponse, apiClient: APIClient = .shared) async {
        let userInfo = response.notification.request.content.userInfo
        let text = (response as? UNTextInputNotificationResponse)?.userText
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        do {
            try await apiClient.initialize()

            switch response.actionIdentifier {
            case NotificationAction.approve, NotificationAction.decline:
                try await resolveApproval(
                    userInfo,
                    approved: response.actionIdentifier == NotificationAction.approve,
                    apiClient: apiClient
                )
            case NotificationAction.answer:
                try await answerQuestion(userInfo, text: text, apiClient: apiClient)
            case NotificationAction.replyToPoly:
                guard !text.isEmpty else { return }
                let answer = try await PolyThread.ask(text, apiClient: apiClient)
                await post(title: "Poly", body: answer, category: NotificationCategory.polyUpdate)
            default:
                return
            }
        } catch {
            await post(
                title: "That did not land",
                body: "\(error.localizedDescription)\nOpen Polychat to finish it there.",
                category: NotificationCategory.workUpdate
            )
        }
    }

    private static func resolveApproval(
        _ userInfo: [AnyHashable: Any],
        approved: Bool,
        apiClient: APIClient
    ) async throws {
        guard let target = MobileWorkTarget(notificationPayload: userInfo),
              let taskId = target.taskId,
              let interactionId = target.interactionId else {
            throw NotificationActionError.needsApp("This request has no task attached.")
        }

        _ = try await apiClient.resolveProjectTaskApproval(
            projectId: target.projectId,
            taskId: taskId,
            interactionId: interactionId,
            resolution: approved ? "approved" : "rejected"
        )
    }

    private static func answerQuestion(
        _ userInfo: [AnyHashable: Any],
        text: String,
        apiClient: APIClient
    ) async throws {
        guard !text.isEmpty else { return }
        guard let target = MobileWorkTarget(notificationPayload: userInfo),
              let taskId = target.taskId else {
            throw NotificationActionError.needsApp("This question has no task attached.")
        }

        let detail = try await apiClient.fetchProjectTask(projectId: target.projectId, taskId: taskId)
        guard let interaction = detail.interaction,
              interaction.isPending,
              interaction.type == "question",
              let questions = interaction.questions,
              questions.count == 1,
              let question = questions.first else {
            throw NotificationActionError.needsApp("This one has more than one question.")
        }

        let option = question.options.first { $0.label.caseInsensitiveCompare(text) == .orderedSame }?.label
        let freeText = question.options.isEmpty || question.allowOther ? text : nil
        guard let answer = option ?? freeText else {
            throw NotificationActionError.needsApp("That answer needs to be one of the listed options.")
        }

        _ = try await apiClient.answerProjectTaskQuestions(
            projectId: target.projectId,
            taskId: taskId,
            interactionId: interaction.interactionId,
            answers: [UserQuestionAnswer(questionId: question.id, answer: answer)]
        )
    }

    private static func post(title: String, body: String, category: String) async {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = String(body.prefix(240))
        content.categoryIdentifier = category
        content.threadIdentifier = category == NotificationCategory.polyUpdate ? "poly" : "polychat"
        try? await UNUserNotificationCenter.current().add(
            UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
        )
    }
}
