import UserNotifications

enum NotificationCategory {
    static let workApproval = "work.approval"
    static let workInput = "work.input"
    static let workUpdate = "work.update"
    static let polyUpdate = "poly.update"
}

enum NotificationAction {
    static let approve = "work.approve"
    static let decline = "work.decline"
    static let answer = "work.answer"
    static let replyToPoly = "poly.reply"

    static let all: Set<String> = [approve, decline, answer, replyToPoly]
}

enum NotificationCategories {
    static func register(center: UNUserNotificationCenter = .current()) {
        center.setNotificationCategories([
            UNNotificationCategory(
                identifier: NotificationCategory.workApproval,
                actions: [
                    UNNotificationAction(
                        identifier: NotificationAction.approve,
                        title: "Approve",
                        options: [.authenticationRequired],
                        icon: UNNotificationActionIcon(systemImageName: "checkmark")
                    ),
                    UNNotificationAction(
                        identifier: NotificationAction.decline,
                        title: "Decline",
                        options: [.authenticationRequired, .destructive],
                        icon: UNNotificationActionIcon(systemImageName: "xmark")
                    )
                ],
                intentIdentifiers: [],
                options: []
            ),
            UNNotificationCategory(
                identifier: NotificationCategory.workInput,
                actions: [
                    UNTextInputNotificationAction(
                        identifier: NotificationAction.answer,
                        title: "Answer",
                        options: [.authenticationRequired],
                        icon: UNNotificationActionIcon(systemImageName: "text.bubble"),
                        textInputButtonTitle: "Send",
                        textInputPlaceholder: "Your answer"
                    )
                ],
                intentIdentifiers: [],
                options: []
            ),
            UNNotificationCategory(
                identifier: NotificationCategory.workUpdate,
                actions: [],
                intentIdentifiers: [],
                options: []
            ),
            UNNotificationCategory(
                identifier: NotificationCategory.polyUpdate,
                actions: [
                    UNTextInputNotificationAction(
                        identifier: NotificationAction.replyToPoly,
                        title: "Reply to Poly",
                        options: [.authenticationRequired],
                        icon: UNNotificationActionIcon(systemImageName: "bubble.left"),
                        textInputButtonTitle: "Send",
                        textInputPlaceholder: "Tell Poly"
                    )
                ],
                intentIdentifiers: [],
                options: []
            )
        ])
    }
}
