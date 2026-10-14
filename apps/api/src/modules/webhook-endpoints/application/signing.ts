import {
  WEBHOOK_EVENT_ID_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  type WebhookEvent,
} from "@ngriffin_uk/polychat-schemas";
import { hmacSha256, toHex } from "@ngriffin_uk/polychat-utility-server/crypto";
import { parsePublicHttpUrl } from "@ngriffin_uk/polychat-utility-server/http";

const DELIVERY_TIMEOUT_MS = 10_000;

export interface WebhookDeliveryOutcome {
  delivered: boolean;
  status: number | null;
}

export async function signWebhookPayload(
  secret: string,
  body: string,
  timestamp: number,
): Promise<string> {
  const signature = await hmacSha256(secret, `${timestamp}.${body}`);

  return `t=${timestamp},v1=${toHex(signature)}`;
}

export async function deliverWebhookEvent(
  url: string,
  secret: string,
  event: WebhookEvent,
): Promise<WebhookDeliveryOutcome> {
  const target = parsePublicHttpUrl(url);
  const body = JSON.stringify(event);
  const signature = await signWebhookPayload(secret, body, Math.floor(Date.now() / 1000));

  try {
    const response = await fetch(target.toString(), {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        [WEBHOOK_SIGNATURE_HEADER]: signature,
        [WEBHOOK_EVENT_ID_HEADER]: event.id,
      },
      body,
    });

    return { delivered: response.ok, status: response.status };
  } catch {
    return { delivered: false, status: null };
  }
}
