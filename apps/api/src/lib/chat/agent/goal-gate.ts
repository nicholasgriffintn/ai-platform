import type { AgentFinishAssessment } from "@ngriffin_uk/polychat-library-agent-core";
import type { Goal, GoalSurface } from "@ngriffin_uk/polychat-schemas";

import type { ConversationManager } from "~/lib/conversationManager";
import { isUsageExhausted } from "~/lib/usage/limitState";
import type { GoalService } from "~/services/goals/GoalService";

export interface GoalGateParams {
  goalService: GoalService;
  goal: Goal;
  surface: GoalSurface;
  conversationManager?: Pick<ConversationManager, "getUsageLimits">;
  onTerminalStatus?: (goal: Goal) => Promise<void>;
}

export const GOAL_UNSATISFIED_INSTRUCTION = [
  "The active goal is not satisfied yet.",
  "Audit the objective against the evidence in this thread: files changed, commands run, tool results, artifacts produced.",
  "If it is genuinely satisfied, call complete_goal with the evidence ledger.",
  "If no defensible path remains, say what was tried, what blocked it, and what would unblock it.",
  "Otherwise take the single next best action.",
].join(" ");

export function createGoalFinishGate(params: GoalGateParams) {
  let currentGoal = params.goal;

  return async (context: {
    summary: string;
    step: number;
    commandCount: number;
  }): Promise<AgentFinishAssessment> => {
    const latest = await params.goalService.getActiveGoal(
      currentGoal.conversation_id
        ? { conversationId: currentGoal.conversation_id }
        : { sandboxRunId: currentGoal.sandbox_run_id },
    );

    if (!latest || latest.status !== "active") {
      return { allow: true, outcome: latest?.status === "completed" ? "satisfied" : "unsatisfied" };
    }

    const progressed = context.commandCount > currentGoal.iteration_count;
    const usageLimitsExhausted = params.conversationManager
      ? await isUsageExhausted(params.conversationManager)
      : false;
    const { goal, shouldContinue } = await params.goalService.recordIteration({
      goal: latest,
      iteration: {
        surface: params.surface,
        summary: context.summary || "Model returned without calling a tool",
        evidence: [],
        producedEvidence: progressed,
        calledTool: progressed,
        usageLimitsExhausted,
      },
    });

    currentGoal = goal;

    if (!shouldContinue) {
      if (goal.status !== "active") {
        await params.onTerminalStatus?.(goal);
      }

      return {
        allow: true,
        outcome:
          goal.status === "stalled"
            ? "stalled"
            : goal.status === "blocked"
              ? "blocked"
              : "unsatisfied",
      };
    }

    return { allow: false, instruction: GOAL_UNSATISFIED_INSTRUCTION };
  };
}
