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

  if (!type) {
    return;
  }

  await dispatchWebhookEvent(env, {
    userId: run.initiatorUserId,
    type,
    idSeed: `${run.id}:${run.status}:${run.updatedAt}`,
    data: { response: toResponse(run) },
  });
}

export async function dispatchWebhookEvent(
  env: IEnv,
  input: {
    userId: number;
    type: WebhookEventType;
    idSeed: string;
    data: Record<string, unknown>;
  },
): Promise<void> {
  if (!env.DB) {
    return;
  }

  const endpoints = (await new WebhookEndpointRepository(env).listEnabled(input.userId)).filter(
    (endpoint) => endpoint.events.includes(input.type),
  );

  if (endpoints.length === 0) {
    return;
  }

  const event: WebhookEvent = {
    object: "event",
    id: `evt_${(await sha256Hex(input.idSeed)).slice(0, 32)}`,
    type: input.type,
    created_at: new Date().toISOString(),
    data: input.data,
  };
  const taskService = new TaskService(env, new TaskRepository(env));

  await Promise.allSettled(
    endpoints.map((endpoint) =>
      taskService.enqueueTask({
        id: `webhook:${endpoint.id}:${event.id}`,
        task_type: WEBHOOK_DELIVERY_TASK_TYPE,
        user_id: input.userId,
        task_data: { endpointId: endpoint.id, userId: input.userId, event },
        priority: 6,
      }),
    ),
  );
}
