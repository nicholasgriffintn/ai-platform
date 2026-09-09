import type { RepositoryManager } from "~/repositories";
import { publishUserEvent } from "~/services/sync/conversation-events";
import type { SyncPublisher } from "~/services/sync/publish";

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
