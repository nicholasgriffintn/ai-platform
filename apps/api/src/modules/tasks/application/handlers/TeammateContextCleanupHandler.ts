import { teammateContextCleanupTaskDataSchema } from "@ngriffin_uk/polychat-schemas";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { revokeTeammateContextResources } from "~/modules/teammates/application/computers";
import type { IEnv } from "~/types";

import type { TaskHandler, TaskMessage, TaskResult } from "../types";

export class TeammateContextCleanupHandler implements TaskHandler {
  async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    const payload = teammateContextCleanupTaskDataSchema.parse(message.task_data);
    const context = createServiceContext({ env });
    const teammateContexts = await Promise.all(
      payload.contextIds.map((contextId) =>
        context.repositories.teammateContexts.getById(contextId),
      ),
    );
    const activeContexts = teammateContexts.filter((item) => item?.status === "active");

    if (activeContexts.length > 0) {
      throw new Error("Teammate context mutation has not completed");
    }

    await revokeTeammateContextResources(
      context,
      teammateContexts.filter((item) => item !== null && item.status !== "active"),
    );

    return { status: "success", message: "Teammate context resources cleaned up" };
  }
}
