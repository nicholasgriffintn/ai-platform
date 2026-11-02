import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { deliverOutboundOperation } from "~/modules/delivery/application/outbound";
import { sendMobileAlert } from "~/modules/mobile-push/application";
import { POLY_ALERT_PRESENTATION } from "~/modules/mobile-push/domain/presentation";
import { NotificationRepository } from "~/modules/notifications/infrastructure/NotificationRepository";
import { sendWebGatewayNotification } from "~/modules/notifications/infrastructure/web-gateway";
import { TaskNotificationRepository } from "~/modules/task-notifications/infrastructure/TaskNotificationRepository";

import { announceNotificationChange } from "./inbox";

export async function deliverInboxNotification(
  context: ServiceContext,
  id: string,
  assertCurrent: () => Promise<void>,
): Promise<void> {
  const user = context.requireUser();
  const repository = context.repositories.get(NotificationRepository);
  const notification = await repository.get(user.id, id);

  if (
    !notification ||
    notification.status === "cancelled" ||
    notification.dismissedAt ||
    notification.expiresAt <= new Date().toISOString()
  ) {
    return;
  }

  await assertCurrent();
  await repository.update(user.id, id, { status: "succeeded" });
  announceNotificationChange(context);

  if (notification.dispatchedAt) {
    return;
  }

  const path = notification.deepLink;
  const title = "Polychat";
  const body = "You have a new update. Open Polychat to check it.";

  await assertCurrent();
  await sendMobileAlert({
    context,
    userId: user.id,
    alert: {
      id,
      title,
      body,
      data: { kind: "poly", link: `polychat:/${path}` },
      presentation: POLY_ALERT_PRESENTATION,
    },
  });

  if (
    context.env.TASK_NOTIFICATION_PROVIDER_URL &&
    context.env.TASK_NOTIFICATION_PROVIDER_TOKEN &&
    context.env.PRIVATE_KEY
  ) {
    const endpoints = context.repositories.get(TaskNotificationRepository);

    for (const endpoint of await endpoints.listRegistrations(user.id)) {
      if (endpoint.state !== "registered") {
        continue;
      }

      const destination = await endpoints.readWebDestination(user.id, endpoint.id);

      if (!destination) {
        continue;
      }

      await assertCurrent();
      const deliveryId = `${id}:web:${endpoint.id}`;

      try {
        await deliverOutboundOperation({
          context,
          deliveryId,
          userId: user.id,
          kind: "notification",
          scopeId: id,
          operationId: endpoint.id,
          payload: { title, body, path },
          send: async () => {
            const response = await sendWebGatewayNotification(context.env, {
              deliveryId,
              destination,
              title,
              body,
              data: {
                itemId: id,
                deepLink: new URL(path, context.env.APP_BASE_URL ?? "https://polychat.app").href,
              },
            });

            if (response.status === 404 || response.status === 410) {
              await endpoints.markRegistrationFailed(endpoint.id, "endpoint_expired");
            } else if (!response.ok) {
              throw new Error("Notification provider is unavailable");
            }
          },
        });
      } catch (error) {
        context
          .getLogger({ prefix: "notifications/delivery" })
          .warn("A notification could not reach a browser", {
            notificationId: id,
            endpointId: endpoint.id,
            error,
          });
      }
    }
  }

  await assertCurrent();
  await repository.update(user.id, id, { dispatchedAt: new Date().toISOString() });
}
