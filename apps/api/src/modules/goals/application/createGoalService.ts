import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { publishUserEvent } from "~/modules/sync/application/conversation-events";
import type { SyncPublisher } from "~/modules/sync/application/publish";

import { GoalService } from "./GoalService";

export type GoalServiceContext = SyncPublisher & {
  repositories: Pick<RepositoryManager, "goals">;
};

export function createGoalService(context: GoalServiceContext): GoalService {
  return new GoalService(context.repositories.goals, {
    onChanged: (goal) =>
      publishUserEvent(context, goal.user_id, "goal.changed", {
        goalId: goal.id,
        conversationId: goal.conversation_id,
        sandboxRunId: goal.sandbox_run_id,
        status: goal.status,
      }),
  });
}
