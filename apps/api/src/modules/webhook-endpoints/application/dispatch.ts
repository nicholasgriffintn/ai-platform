import {
  WEBHOOK_DELIVERY_TASK_TYPE,
  toResponse,
  type ChatRun,
  type ChatRunStatus,
  type WebhookEvent,
  type WebhookEventType,
} from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";

import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { WebhookEndpointRepository } from "~/modules/webhook-endpoints/infrastructure/WebhookEndpointRepository";
import type { IEnv } from "~/types";

const RUN_STATUS_EVENTS: Partial<Record<ChatRunStatus, WebhookEventType>> = {
  succeeded: "response.completed",
  failed: "response.failed",
  cancelled: "response.cancelled",
  interrupted: "response.incomplete",
  awaiting_input: "response.waiting",
  awaiting_approval: "response.waiting",
  awaiting_takeover: "response.waiting",
};

export async function dispatchResponseWebhooks(env: IEnv, run: ChatRun): Promise<void> {
  const type = RUN_STATUS_EVENTS[run.status];

  if (!type || !env.DB) {
    return;
  }

  const endpoints = (
    await new WebhookEndpointRepository(env).listEnabled(run.initiatorUserId)
  ).filter((endpoint) => endpoint.events.includes(type));

  if (endpoints.length === 0) {
    return;
  }

  const event: WebhookEvent = {
    object: "event",
    id: `evt_${(await sha256Hex(`${run.id}:${run.status}:${run.updatedAt}`)).slice(0, 32)}`,
    type,
    created_at: new Date().toISOString(),
    data: { response: toResponse(run) },
  };
  const taskService = new TaskService(env, new TaskRepository(env));

  await Promise.allSettled(
    endpoints.map((endpoint) =>
      taskService.enqueueTask({
        id: `webhook:${endpoint.id}:${event.id}`,
        task_type: WEBHOOK_DELIVERY_TASK_TYPE,
        user_id: run.initiatorUserId,
        task_data: { endpointId: endpoint.id, userId: run.initiatorUserId, event },
        priority: 6,
      }),
    ),
  );
}
