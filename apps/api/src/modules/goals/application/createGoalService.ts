import type { Repositories } from "~/infrastructure/database/repositories";
import { GoalRepository } from "~/modules/goals/infrastructure/GoalRepository";
import { publishUserEvent } from "~/modules/sync/application/conversation-events";
import type { SyncPublisher } from "~/modules/sync/application/publish";

import { GoalService } from "./GoalService";

export type GoalServiceContext = SyncPublisher & {
  repositories: Repositories;
};

export function createGoalService(context: GoalServiceContext): GoalService {
  return new GoalService(context.repositories.get(GoalRepository), {
    onChanged: (goal) =>
      publishUserEvent(context, goal.user_id, "goal.changed", {
        goalId: goal.id,
        conversationId: goal.conversation_id,
        sandboxRunId: goal.sandbox_run_id,
        status: goal.status,
      }),
  });
}
