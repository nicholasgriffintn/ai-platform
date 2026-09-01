import { runInfraReconciliation } from "~/services/infra/reconciliation";
import type { IEnv } from "~/types";
import { getLogger } from "~/utils/logger";
import { isRecord } from "~/utils/objects";

import type { TaskHandler, TaskResult } from "../TaskHandler";
import type { TaskMessage } from "../TaskService";

const logger = getLogger({ prefix: "services/tasks/infra-reconciliation" });

export class InfraReconciliationHandler implements TaskHandler {
  public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    const day =
      isRecord(message.task_data) && typeof message.task_data.day === "string"
        ? message.task_data.day
        : undefined;

    try {
      const result = await runInfraReconciliation({ env, day });

      return {
        status: result.status === "skipped" ? "skipped" : "success",
        message:
          result.status === "skipped"
            ? "Infra reconciliation skipped: analytics token not configured"
            : `Reconciled ${result.rowsWritten} infra cost rows for ${result.day}`,
        data: { day: result.day, rowsWritten: result.rowsWritten },
      };
    } catch (error) {
      logger.error("Infra reconciliation failed", { error, day });

      return { status: "error", message: (error as Error).message };
    }
  }
}
