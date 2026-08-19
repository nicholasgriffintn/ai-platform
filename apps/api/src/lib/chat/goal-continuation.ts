import type { ServiceContext } from "~/lib/context/serviceContext";
import { GoalService } from "~/services/goals/GoalService";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/chat/goal-continuation" });

export const GOAL_CONTINUATION_INSTRUCTION = [
  "The active goal is not satisfied yet.",
  "Audit the objective against the evidence in this thread: files changed, commands run, tool results, artifacts produced.",
  "If it is genuinely satisfied, call complete_goal with the evidence ledger.",
  "If no defensible path remains, say what was tried, what blocked it, and what would unblock it.",
  "Otherwise take the single next best action.",
].join(" ");

export interface StreamingGoalContinuationParams {
  completionId: string;
  context?: ServiceContext;
  summary: string;
  producedEvidence: boolean;
}

/**
 * Applies the goal contract to a streaming turn that ended without tool calls.
 * Returns the instruction for the next turn, or null when the goal is done,
 * absent, or has stopped for any of the reasons the shared policy recognises.
 */
export async function resolveStreamingGoalContinuation(
  params: StreamingGoalContinuationParams,
): Promise<{ instruction: string } | null> {
  const user = params.context?.user;
  const repositories = params.context?.repositories;

  if (!user?.id || user.plan_id !== "pro" || !repositories?.goals || !params.completionId) {
    return null;
  }

  try {
    const service = new GoalService(repositories.goals);
    const goal = await service.getActiveGoal({ conversationId: params.completionId });

    if (!goal || goal.status !== "active") {
      return null;
    }

    const { shouldContinue } = await service.recordIteration({
      goal,
      iteration: {
        surface: "chat",
        summary: params.summary || "Model responded without calling a tool",
        producedEvidence: params.producedEvidence,
        calledTool: params.producedEvidence,
      },
    });

    return shouldContinue ? { instruction: GOAL_CONTINUATION_INSTRUCTION } : null;
  } catch (error) {
    logger.error("Failed to evaluate goal continuation", { error });

    return null;
  }
}
