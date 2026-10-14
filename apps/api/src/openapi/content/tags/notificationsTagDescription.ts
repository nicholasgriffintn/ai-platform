import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const notificationsTagDescription = md`
# Notifications

The task inbox and how it reaches you. List inbox items unread first, mark them read or dismiss them, and register installations for delivery. \`GET /notifications/{notification_id}\` resolves where a notification should take you now.

iOS push tokens register through \`/devices\`.
`;
