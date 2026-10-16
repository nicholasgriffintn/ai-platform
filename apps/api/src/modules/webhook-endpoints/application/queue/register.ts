import { WEBHOOK_DELIVERY_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";

import type { AppWorkflows } from "~/modules/queue/application/workflows";
import { WebhookDeliveryHandler } from "~/modules/webhook-endpoints/application/delivery";

export function registerWebhookEndpointsQueue(workflows: AppWorkflows): void {
  workflows.register(WEBHOOK_DELIVERY_TASK_TYPE, new WebhookDeliveryHandler());
}
