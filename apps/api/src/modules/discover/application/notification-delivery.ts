import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { isDiscoverQuiet } from "~/modules/discover/domain/day";
import { deliverInboxNotification } from "~/modules/notifications/application/delivery";
import { NotificationRepository } from "~/modules/notifications/infrastructure/NotificationRepository";
import { admitSharedPolyNotification } from "~/modules/poly/application/notification-budget";

import { judgeDiscoverNewsAlert } from "./news-alert-judgement";
import { readDiscoverNotificationState } from "./notifications";

export async function deliverDiscoverNotification(
  context: ServiceContext,
  id: string,
  assertOwned: () => Promise<void>,
): Promise<void> {
  const user = context.requireUser();
  const repository = context.repositories.get(NotificationRepository);
  const state = await readDiscoverNotificationState(context, id, { forDelivery: true });
  const notification = state.notification;

  if (!notification) {
    return;
  }

  if (!state.subject) {
    await repository.update(user.id, id, { status: "cancelled" });

    return;
  }

  const preferences = state.profile.notifications;

  if (!preferences.enabled || !preferences[notification.category]) {
    return;
  }

  if (isDiscoverQuiet(state.profile, new Date())) {
    return;
  }

  if (
    notification.category === "news" &&
    notification.decision === "eligible" &&
    state.settings.installationId
  ) {
    await assertOwned();
    const urgent = await judgeDiscoverNewsAlert(context, {
      itemId: notification.subjectId,
      installationId: state.settings.installationId,
    });

    if (!urgent) {
      await repository.update(user.id, id, { status: "cancelled" });

      return;
    }

    await repository.update(user.id, id, { payload: { decision: "approved" } });
  }

  const admission = await admitSharedPolyNotification(context, {
    id,
    category: "discover",
    urgency: "high",
    polyConversationId: state.poly.homeConversationId,
    paused: false,
    discoverLimit: state.profile.notifications.dailyLimit,
  });

  if (!admission.admitted) {
    return;
  }

  await deliverInboxNotification(context, id, async () => {
    await assertOwned();
    const latest = await readDiscoverNotificationState(context, id, { forDelivery: true });

    if (
      !latest.subject ||
      !latest.profile.notifications.enabled ||
      !latest.profile.notifications[notification.category] ||
      isDiscoverQuiet(latest.profile, new Date())
    ) {
      throw new Error("Discover update is no longer current");
    }
  });
}
