import type {
  MobileWorkNotification,
  MobileWorkNotificationKind,
  MobileWorkNotificationTarget,
  ProjectTask,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { MobilePushDeviceRecord } from "~/repositories/MobilePushRepository";
import type { IEnv } from "~/types";
import { base64ToBuffer, stringToBase64Url } from "~/utils/base64";
import { encodeBase64Url } from "~/utils/base64url";
import { sha256Hex } from "~/utils/crypto";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/mobile-push" });
const TOKEN_LIFETIME_MS = 45 * 60 * 1000;
let cachedProviderToken: { value: string; createdAt: number; keyId: string } | undefined;

const SAFE_ALERTS: Record<MobileWorkNotificationKind, { title: string; body: string }> = {
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

function hasConfiguration(
  env: IEnv,
): env is IEnv &
  Required<Pick<IEnv, "APNS_KEY_ID" | "APNS_TEAM_ID" | "APNS_PRIVATE_KEY" | "APNS_TOPIC">> {
  return Boolean(env.APNS_KEY_ID && env.APNS_TEAM_ID && env.APNS_PRIVATE_KEY && env.APNS_TOPIC);
}

async function createProviderToken(env: IEnv): Promise<string | null> {
  if (!hasConfiguration(env)) {
    return null;
  }

  if (
    cachedProviderToken?.keyId === env.APNS_KEY_ID &&
    Date.now() - cachedProviderToken.createdAt < TOKEN_LIFETIME_MS
  ) {
    return cachedProviderToken.value;
  }

  const encodedHeader = stringToBase64Url(JSON.stringify({ alg: "ES256", kid: env.APNS_KEY_ID }));
  const encodedPayload = stringToBase64Url(
    JSON.stringify({ iss: env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) }),
  );
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const privateKeyBytes = base64ToBuffer(
    env.APNS_PRIVATE_KEY.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, ""),
  );
  const privateKeyBuffer = Uint8Array.from(privateKeyBytes).buffer;
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(signingInput),
  );
  const value = `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`;

  cachedProviderToken = { value, createdAt: Date.now(), keyId: env.APNS_KEY_ID };

  return value;
}

async function deliveryId(notificationId: string, deviceId: string): Promise<string> {
  return sha256Hex(`mobile-push:${notificationId}:${deviceId}`);
}

function endpoint(device: MobilePushDeviceRecord): string {
  const host =
    device.environment === "sandbox"
      ? "https://api.sandbox.push.apple.com"
      : "https://api.push.apple.com";

  return `${host}/3/device/${device.token}`;
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

  let response: Response;

  try {
    response = await fetch(endpoint(params.device), {
      method: "POST",
      headers: {
        authorization: `bearer ${params.providerToken}`,
        "apns-topic": params.topic,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "apns-expiration": "0",
        "apns-collapse-id": id.slice(0, 64),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        aps: {
          alert: { title: params.notification.title, body: params.notification.body },
          sound: "default",
        },
        polychat: {
          id: params.notification.id,
          kind: params.notification.kind,
          target: params.notification.target,
        },
      }),
    });
  } catch (error) {
    const errorCode = error instanceof Error ? error.name : "network_error";

    await params.context.repositories.mobilePush.finishDelivery(id, "failed", errorCode);
    logger.warn("Mobile push delivery request failed", {
      notificationId: params.notification.id,
      deviceId: params.device.id,
      errorCode,
    });

    return;
  }

  if (response.ok) {
    await params.context.repositories.mobilePush.finishDelivery(id, "sent");

    return;
  }

  const failure = await response.json<{ reason?: string }>().catch((): { reason?: string } => ({}));
  const reason = failure.reason ?? `APNs ${response.status}`;

  await params.context.repositories.mobilePush.finishDelivery(id, "failed", reason);

  if (response.status === 410 || reason === "BadDeviceToken" || reason === "Unregistered") {
    await params.context.repositories.mobilePush.invalidateDevice(params.device.id);
  }

  logger.warn("Mobile push delivery failed", {
    notificationId: params.notification.id,
    deviceId: params.device.id,
    status: response.status,
    reason,
  });
}

export async function sendMobileWorkNotification(params: {
  context: ServiceContext;
  userId: number;
  notification: MobileWorkNotification;
}): Promise<void> {
  const providerToken = await createProviderToken(params.context.env);

  if (!providerToken || !params.context.env.APNS_TOPIC) {
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
    const membership = await params.context.repositories.workspaces.getMembership(
      params.task.workspaceId,
      recipientUserId,
    );

    if (!membership) {
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
