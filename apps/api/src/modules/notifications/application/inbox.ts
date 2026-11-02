import {
  TASK_NOTIFICATION_PROTOCOL_VERSION,
  type WorkInboxItem,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { NotificationRepository } from "~/modules/notifications/infrastructure/NotificationRepository";
import { publishUserEvent } from "~/modules/sync/application/conversation-events";

export async function listNotificationInboxItems(
  context: ServiceContext,
): Promise<WorkInboxItem[]> {
  const notifications = await context.repositories
    .get(NotificationRepository)
    .list(context.requireUser().id);

  return notifications.map((notification) => ({
    id: notification.id,
    kind: "update",
    workspaceId: null,
    projectId: null,
    taskId: null,
    teammateId: null,
    title: notification.title,
    detail: notification.body,
    dueAt: null,
    conversationId: null,
    since: notification.createdAt,
    readAt: notification.readAt,
    deepLink: notification.deepLink,
  }));
}

export async function resolveInboxNotification(context: ServiceContext, id: string) {
  const notification = await context.repositories
    .get(NotificationRepository)
    .get(context.requireUser().id, id);
  const current =
    notification?.status === "succeeded" &&
    !notification.dismissedAt &&
    notification.expiresAt > new Date().toISOString();

  return {
    protocolVersion: TASK_NOTIFICATION_PROTOCOL_VERSION,
    itemId: id,
    current,
    deepLink: current ? notification.deepLink : null,
  };
}

export function announceNotificationChange(context: ServiceContext) {
  publishUserEvent(context, context.requireUser().id, "attention.changed", { action: "update" });
}
