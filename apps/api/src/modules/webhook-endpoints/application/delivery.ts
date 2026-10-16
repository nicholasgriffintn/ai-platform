import { webhookDeliveryTaskDataSchema, webhookEventSchema } from "@ngriffin_uk/polychat-schemas";

import { openSecret } from "~/infrastructure/secret-envelope";
import type { TaskHandler, TaskMessage, TaskResult } from "~/modules/queue/application/types";
import { WebhookEndpointRepository } from "~/modules/webhook-endpoints/infrastructure/WebhookEndpointRepository";
import type { IEnv } from "~/types";

import { deliverWebhookEvent } from "./signing";

export class WebhookDeliveryHandler implements TaskHandler {
  async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    const task = webhookDeliveryTaskDataSchema.safeParse(message.task_data);
    const event = task.success ? webhookEventSchema.safeParse(task.data.event) : null;

    if (!task.success || !event?.success) {
      return { status: "skipped", message: "Webhook delivery payload is invalid" };
    }

    const endpoint = await new WebhookEndpointRepository(env).get(
      task.data.userId,
      task.data.endpointId,
    );

    if (!endpoint?.enabled || !endpoint.events.includes(event.data.type)) {
      return { status: "skipped", message: "Webhook endpoint no longer wants this event" };
    }

    const outcome = await deliverWebhookEvent(
      endpoint.url,
      await openSecret(env, endpoint.encrypted_secret),
      event.data,
    );

    return outcome.delivered
      ? { status: "success", data: { status: outcome.status } }
      : { status: "error", message: `Webhook endpoint answered ${outcome.status ?? "nothing"}` };
  }
}
