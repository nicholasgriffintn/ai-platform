import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type {
  MobileWorkNotification,
  MobileWorkNotificationKind,
  MobileWorkNotificationTarget,
  ProjectTask,
} from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  getApnsProviderToken,
  isApnsConfigured,
  sendApnsAlert,
} from "~/modules/mobile-push/infrastructure/apns-client";
import type { MobilePushDeviceRecord } from "~/modules/mobile-push/infrastructure/MobilePushRepository";
import {
  isTaskNotificationPreferenceEnabled,
  notificationCategoryForMobileKind,
} from "~/modules/notifications/application/preferences";

const logger = getLogger({ prefix: "services/mobile-push" });

const SAFE_ALERTS: Record<MobileWorkNotificationKind, { title: string; body: string }> = {
  assigned: {
    title: "Work was assigned",
    body: "Open Polychat to review the task.",
  },
  input: {
    title: "Work needs input",
    body: "Open Polychat to review the current request.",
  },
  approval: {
    title: "Work needs approval",
    body: "Open Polychat to review the current request.",
  },
  review: {
    title: "Work is ready for review",
    body: "Open Polychat to review the latest result.",
  },
  completed: {
    title: "Work completed",
    body: "Open Polychat to review the result.",
  },
  failed: {
    title: "Work stopped",
    body: "Open Polychat to review what happened.",
  },
};

async function deliveryId(notificationId: string, deviceId: string): Promise<string> {
  return sha256Hex(`mobile-push:${notificationId}:${deviceId}`);
}

async function sendToDevice(params: {
  context: ServiceContext;
  device: MobilePushDeviceRecord;
  notification: MobileWorkNotification;
  providerToken: string;
  topic: string;
}): Promise<void> {
  const id = await deliveryId(params.notification.id, params.device.id);

  if (!(await params.context.repositories.mobilePush.claimDelivery(id, params.device.id))) {
    return;
  }

  const result = await sendApnsAlert({
    device: params.device,
    notification: params.notification,
    providerToken: params.providerToken,
    topic: params.topic,
    collapseId: id,
  });

  if (result.status === "sent") {
    await params.context.repositories.mobilePush.finishDelivery(id, "sent");

    return;
  }

  await params.context.repositories.mobilePush.finishDelivery(id, "failed", result.reason);

  if (result.invalidateDevice) {
    await params.context.repositories.mobilePush.invalidateDevice(params.device.id);
  }

  logger.warn("Mobile push delivery failed", {
    notificationId: params.notification.id,
    deviceId: params.device.id,
    reason: result.reason,
  });
}

export async function sendMobileWorkNotification(params: {
  context: ServiceContext;
  userId: number;
  notification: MobileWorkNotification;
}): Promise<void> {
  if (!isApnsConfigured(params.context.env)) {
    return;
  }

  const providerToken = await getApnsProviderToken(params.context.env);

  if (!providerToken) {
    return;
  }

  const devices = await params.context.repositories.mobilePush.listActiveForUser(params.userId);
  const matchingDevices = devices.filter(
    (device) => device.app_bundle_id === params.context.env.APNS_TOPIC,
  );

  await Promise.allSettled(
    matchingDevices.map((device) =>
      sendToDevice({
        context: params.context,
        device,
        notification: params.notification,
        providerToken,
        topic: params.context.env.APNS_TOPIC ?? "",
      }),
    ),
  );
}

export async function notifyMobileWork(params: {
  context: ServiceContext;
  userId: number;
  notificationId: string;
  kind: MobileWorkNotificationKind;
  target: MobileWorkNotificationTarget;
}): Promise<void> {
  try {
    await sendMobileWorkNotification({
      context: params.context,
      userId: params.userId,
      notification: {
        id: params.notificationId,
        kind: params.kind,
        ...SAFE_ALERTS[params.kind],
        target: params.target,
      },
    });
  } catch (error) {
    logger.warn("Mobile push notification could not be prepared", {
      notificationId: params.notificationId,
      userId: params.userId,
      error,
    });
  }
}

export async function notifyMobileProjectRun(params: {
  context: ServiceContext;
  userId: number;
  notificationId: string;
  kind: MobileWorkNotificationKind;
  projectId: string | null | undefined;
  conversationId: string | null;
  runId: string;
  interactionId?: string | null;
}): Promise<void> {
  try {
    if (!params.projectId) {
      return;
    }

    const project = await params.context.repositories.workspaces.getProject(params.projectId);

    if (!project) {
      return;
    }

    const membership = await params.context.repositories.workspaces.getMembership(
      project.workspace_id,
      params.userId,
    );

    if (!membership) {
      return;
    }

    await notifyMobileWork({
      context: params.context,
      userId: params.userId,
      notificationId: params.notificationId,
      kind: params.kind,
      target: {
        workspaceId: project.workspace_id,
        projectId: project.id,
        conversationId: params.conversationId,
        taskId: null,
        runId: params.runId,
        interactionId: params.interactionId ?? null,
      },
    });
  } catch (error) {
    logger.warn("Project run notification could not be resolved", {
      notificationId: params.notificationId,
      runId: params.runId,
      error,
    });
  }
}

export async function notifyMobileProjectTask(params: {
  context: ServiceContext;
  task: ProjectTask;
  notificationId: string;
  kind: MobileWorkNotificationKind;
  interactionId?: string | null;
}): Promise<void> {
  try {
    const recipientUserId = params.task.assigneeUserId ?? params.task.createdByUserId;
    const [membership, preferences] = await Promise.all([
      params.context.repositories.workspaces.getMembership(
        params.task.workspaceId,
        recipientUserId,
      ),
      params.context.repositories.taskNotifications.getPreferences(recipientUserId),
    ]);

    if (
      !membership ||
      !isTaskNotificationPreferenceEnabled(
        preferences,
        notificationCategoryForMobileKind(params.kind),
      )
    ) {
      return;
    }

    await notifyMobileWork({
      context: params.context,
      userId: recipientUserId,
      notificationId: params.notificationId,
      kind: params.kind,
      target: {
        workspaceId: params.task.workspaceId,
        projectId: params.task.projectId,
        conversationId: params.task.conversationId,
        taskId: params.task.id,
        runId: null,
        interactionId: params.interactionId ?? null,
      },
    });
  } catch (error) {
    logger.warn("Project task notification could not be resolved", {
      notificationId: params.notificationId,
      taskId: params.task.id,
      error,
    });
  }
}
