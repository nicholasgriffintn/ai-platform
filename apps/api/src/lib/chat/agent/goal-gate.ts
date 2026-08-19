import type { AgentFinishAssessment } from "@ngriffin_uk/polychat-library-agent-core";
import type { Goal, GoalSurface } from "@ngriffin_uk/polychat-schemas";

import type { GoalService } from "~/services/goals/GoalService";

export interface GoalGateParams {
  goalService: GoalService;
  goal: Goal;
  surface: GoalSurface;
  onTerminalStatus?: (goal: Goal) => Promise<void>;
}

const UNSATISFIED_INSTRUCTION = [
  "The active goal is not satisfied yet.",
  "Audit the objective against the evidence in this thread: files changed, commands run, tool results, artifacts produced.",
  "If it is genuinely satisfied, call complete_goal with the evidence ledger.",
  "If no defensible path remains, say what was tried, what blocked it, and what would unblock it.",
  "Otherwise take the single next best action.",
].join(" ");

/**
 * Turns a `finish` into a question rather than an exit while a goal is live.
 * The model only leaves the loop by calling complete_goal (evidence-checked in
 * GoalService) or by the goal reaching a terminal state.
 */
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
    const { goal, shouldContinue } = await params.goalService.recordIteration({
      goal: latest,
      iteration: {
        surface: params.surface,
        summary: context.summary || "Model returned without calling a tool",
        evidence: [],
        producedEvidence: progressed,
        calledTool: progressed,
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

    return { allow: false, instruction: UNSATISFIED_INSTRUCTION };
  };
}
