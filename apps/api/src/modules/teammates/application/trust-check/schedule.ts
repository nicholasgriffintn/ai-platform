import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  TEAMMATE_TRUST_CHECK_TASK_TYPE,
  type TeammateTrustCheckTask,
} from "@ngriffin_uk/polychat-schemas";
import { generateId, parsePositiveInteger } from "@ngriffin_uk/polychat-utility-core";

import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import type { IEnv } from "~/types";

const logger = getLogger({ prefix: "teammates/trust-check/schedule" });

export async function enqueueTeammateTrustCheck(
  env: IEnv,
  userId: number,
  task: TeammateTrustCheckTask = {},
): Promise<string> {
  return new TaskService(env, new TaskRepository(env)).enqueueTask({
    id: `${TEAMMATE_TRUST_CHECK_TASK_TYPE}_${generateId()}`,
    task_type: TEAMMATE_TRUST_CHECK_TASK_TYPE,
    user_id: userId,
    task_data: task,
    priority: 8,
  });
}

export async function scheduleTeammateTrustCheck(env: IEnv): Promise<void> {
  const operatorId = parsePositiveInteger(env.TEAMMATE_TRUST_CHECK_USER_ID);

  if (!operatorId) {
    return;
  }

  try {
    await enqueueTeammateTrustCheck(env, operatorId);
  } catch (error) {
    logger.error("Failed to schedule the teammate trust check", error);
  }
}
