import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { TEAMMATE_RUN_RECONCILIATION_TASK_TYPE, type ChatRun } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import type { AgentLoopExecutionResult } from "~/modules/responses/application/engine/agent/agent-loop";
import {
  reconcileTeammateRun,
  teammateRunNeedsReconciliation,
} from "~/modules/teammates/application/run-reconciliation";

const logger = getLogger({ prefix: "services/chat-runs/teammate-settlement" });

export async function settleTeammateRun(
  context: ServiceContext,
  run: ChatRun,
  result?: AgentLoopExecutionResult,
): Promise<void> {
  if (!teammateRunNeedsReconciliation(run)) {
    return;
  }

  try {
    await reconcileTeammateRun(context, run, result);
  } catch (error) {
    logger.warn("Immediate teammate run reconciliation failed", {
      runId: run.id,
      attempt: run.attempt,
      error: getErrorMessage(error),
    });
  }

  try {
    await new TaskService(context.env, context.repositories.get(TaskRepository)).enqueueTask({
      id: `teammate_run_reconciliation_${run.id}_${run.attempt}`,
      task_type: TEAMMATE_RUN_RECONCILIATION_TASK_TYPE,
      user_id: run.initiatorUserId,
      ...(run.projectId ? { project_id: run.projectId } : {}),
      priority: 4,
      task_data: { runId: run.id, attempt: run.attempt },
    });
  } catch (error) {
    logger.warn("Teammate run reconciliation remains pending", {
      runId: run.id,
      attempt: run.attempt,
      error: getErrorMessage(error),
    });
  }
}
