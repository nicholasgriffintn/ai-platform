import {
  TASK_NOTIFICATION_DELIVERY_TASK_TYPE,
  TASK_NOTIFICATION_PROTOCOL_VERSION,
  createTaskInboxItemId,
  type TaskNotificationCategory,
} from "@ngriffin_uk/polychat-schemas";

import { RepositoryManager } from "~/repositories";
import { isTaskNotificationPreferenceEnabled } from "~/services/notifications/preferences";
import { attentionState, isTaskInboxEligible } from "~/services/project-tasks/attention";
import type { IEnv } from "~/types";
import { getErrorMessage } from "~/utils/errors";
import { isRecord } from "~/utils/objects";

import type { TaskExecutionContext, TaskHandler, TaskResult } from "../tasks/TaskHandler";
import type { TaskMessage } from "../tasks/TaskService";
import { TaskService } from "../tasks/TaskService";

const NOTIFICATION_COPY: Record<TaskNotificationCategory, string> = {
  decisions: "A task needs your decision.",
  failures: "A task needs attention after a problem.",
  completions: "A task has completed.",
  assignments: "A task was assigned to you.",
};

function retryAt(attempt: number): string {
  const delaySeconds = Math.min(60 * 60, 30 * 2 ** Math.max(0, attempt - 1));

  return new Date(Date.now() + delaySeconds * 1000).toISOString();
}

export class TaskNotificationDeliveryHandler implements TaskHandler {
  async handle(
    message: TaskMessage,
    env: IEnv,
    context: TaskExecutionContext,
  ): Promise<TaskResult> {
    const deliveryId = isRecord(message.task_data) ? message.task_data.deliveryId : null;

    if (typeof deliveryId !== "string") {
      return { status: "skipped", message: "Notification delivery ID is missing" };
    }

    const repository = new RepositoryManager(env).taskNotifications;
    const candidate = await repository.getDeliveryContext(deliveryId);

    if (!candidate || candidate.delivery.status !== "pending") {
      return { status: "skipped", message: "Notification delivery is no longer pending" };
    }

    const state = attentionState({
      status: candidate.task.status,
      blockedReason: candidate.task.blockedReason,
    });
    const isCurrent =
      candidate.hasWorkspaceAccess &&
      candidate.registration.state === "registered" &&
      candidate.task.attentionVersion === candidate.delivery.task_version &&
      state?.category === candidate.delivery.category &&
      state !== null &&
      isTaskInboxEligible(candidate.task, state, candidate.delivery.user_id) &&
      isTaskNotificationPreferenceEnabled(candidate.preferences, candidate.delivery.category);

    if (!isCurrent) {
      await repository.updateDelivery(deliveryId, { status: "obsolete" });

      return { status: "skipped", message: "Notification no longer matches current task state" };
    }

    if (!env.TASK_NOTIFICATION_PROVIDER_URL || !env.TASK_NOTIFICATION_PROVIDER_TOKEN) {
      await repository.updateDelivery(deliveryId, {
        status: "pending",
        failureCode: "provider_not_configured",
      });

      return { status: "skipped", message: "Task notification provider is not configured" };
    }

    const providerUrl = new URL(env.TASK_NOTIFICATION_PROVIDER_URL);

    if (providerUrl.protocol !== "https:") {
      throw new Error("Task notification provider URL must use HTTPS");
    }

    const itemId = createTaskInboxItemId(candidate.task.id, candidate.task.attentionVersion);
    const deepLink = `${env.APP_BASE_URL ?? "https://polychat.app"}/work/${encodeURIComponent(
      candidate.task.workspaceId,
    )}/projects/${encodeURIComponent(candidate.task.projectId)}/tasks/${encodeURIComponent(
      candidate.task.id,
    )}?notification=${encodeURIComponent(itemId)}`;

    try {
      await context.lease.assertOwned();
      const response = await fetch(providerUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.TASK_NOTIFICATION_PROVIDER_TOKEN}`,
          "Content-Type": "application/json",
          "Idempotency-Key": deliveryId,
        },
        body: JSON.stringify({
          protocolVersion: TASK_NOTIFICATION_PROTOCOL_VERSION,
          deliveryId,
          platform: candidate.registration.platform,
          destination: {
            endpoint: candidate.registration.endpoint,
            p256dh: candidate.registration.p256dh,
            auth: candidate.registration.authSecret,
          },
          notification: {
            title: "Polychat task update",
            body: NOTIFICATION_COPY[candidate.delivery.category],
            data: { itemId, deepLink },
          },
        }),
      });

      if (response.status === 404 || response.status === 410) {
        await repository.markRegistrationFailed(candidate.registration.id, "endpoint_expired");
        await repository.updateDelivery(deliveryId, {
          status: "failed",
          failureCode: "endpoint_expired",
          incrementAttempts: true,
        });

        return { status: "skipped", message: "Notification endpoint expired" };
      }

      if (!response.ok) {
        throw new Error(`Notification provider returned ${response.status}`);
      }

      const responseBody: unknown = await response.json().catch(() => null);
      const providerMessageId =
        isRecord(responseBody) && typeof responseBody.id === "string" ? responseBody.id : null;

      await repository.updateDelivery(deliveryId, {
        status: "delivered",
        providerMessageId,
        incrementAttempts: true,
      });

      return { status: "success", message: "Task notification delivered" };
    } catch (error) {
      await repository.updateDelivery(deliveryId, {
        status: "pending",
        failureCode: "provider_unavailable",
        nextAttemptAt: retryAt(candidate.delivery.attempts + 1),
        incrementAttempts: true,
      });

      return { status: "error", message: getErrorMessage(error) };
    }
  }

  async onFinalFailure(message: TaskMessage, env: IEnv): Promise<void> {
    const deliveryId = isRecord(message.task_data) ? message.task_data.deliveryId : null;

    if (typeof deliveryId === "string") {
      await new RepositoryManager(env).taskNotifications.updateDelivery(deliveryId, {
        status: "pending",
        failureCode: "provider_unavailable",
        nextAttemptAt: retryAt(message.max_attempts ?? 3),
      });
    }
  }
}

export async function schedulePendingTaskNotificationDeliveries(env: IEnv): Promise<number> {
  if (!env.TASK_NOTIFICATION_PROVIDER_URL || !env.TASK_NOTIFICATION_PROVIDER_TOKEN) {
    return 0;
  }

  const repositories = new RepositoryManager(env);
  const ids = await repositories.taskNotifications.listPendingDeliveryIds();
  const taskService = new TaskService(env, repositories.tasks);
  const bucket = Math.floor(Date.now() / (15 * 60 * 1000));

  const results = await Promise.allSettled(
    ids.map((deliveryId) =>
      taskService.enqueueTask({
        id: `task-notification:${deliveryId}:${bucket}`,
        task_type: TASK_NOTIFICATION_DELIVERY_TASK_TYPE,
        task_data: { deliveryId },
        priority: 7,
      }),
    ),
  );

  return results.filter((result) => result.status === "fulfilled").length;
}
