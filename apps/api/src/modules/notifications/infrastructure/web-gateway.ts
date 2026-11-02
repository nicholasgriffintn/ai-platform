import { TASK_NOTIFICATION_PROTOCOL_VERSION } from "@ngriffin_uk/polychat-schemas";

import type { IEnv } from "~/types";

export async function sendWebGatewayNotification(
  env: IEnv,
  input: {
    deliveryId: string;
    destination: { endpoint: string; p256dh: string | null; auth: string | null | undefined };
    title: string;
    body: string;
    data: Record<string, string>;
  },
): Promise<Response> {
  if (!env.TASK_NOTIFICATION_PROVIDER_URL || !env.TASK_NOTIFICATION_PROVIDER_TOKEN) {
    throw new Error("Notification provider is not configured");
  }

  const url = new URL(env.TASK_NOTIFICATION_PROVIDER_URL);

  if (url.protocol !== "https:") {
    throw new Error("Notification provider URL must use HTTPS");
  }

  return fetch(url, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Bearer ${env.TASK_NOTIFICATION_PROVIDER_TOKEN}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.deliveryId,
    },
    body: JSON.stringify({
      protocolVersion: TASK_NOTIFICATION_PROTOCOL_VERSION,
      deliveryId: input.deliveryId,
      platform: "web",
      destination: input.destination,
      notification: { title: input.title, body: input.body, data: input.data },
    }),
  });
}
