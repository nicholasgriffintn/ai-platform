import { applyUsageRollup, type UsageRollupPayload } from "@ngriffin_uk/polychat-ai-billing";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";

import { createUsageRuntime } from "~/services/usage/runtime";
import type { IEnv } from "~/types";

import type { TaskHandler, TaskResult } from "../TaskHandler";
import type { TaskMessage } from "../TaskService";

const logger = getLogger({ prefix: "services/tasks/usage-rollup" });

export class UsageRollupHandler implements TaskHandler {
  public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    const payload = message.task_data as UsageRollupPayload | undefined;
    const events = payload?.events;

    if (!Array.isArray(events) || events.length === 0) {
      return { status: "skipped", message: "No usage events to roll up" };
    }

    try {
      const { inserted } = await applyUsageRollup(createUsageRuntime({ env }), events);

      return {
        status: "success",
        message: `Rolled up ${inserted} of ${events.length} usage events`,
        data: { inserted, received: events.length },
      };
    } catch (error) {
      logger.error("Failed to roll up usage events", { error, taskId: message.taskId });

      return { status: "error", message: (error as Error).message };
    }
  }
}
