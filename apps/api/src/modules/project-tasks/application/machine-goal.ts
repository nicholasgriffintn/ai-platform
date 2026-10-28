import type { ChatRun, Goal } from "@ngriffin_uk/polychat-schemas";

import type { GoalService } from "~/modules/goals/application/GoalService";

export async function settleMachineAgentGoal(
  goalService: GoalService,
  goal: Goal,
  turn: { run: ChatRun | null; output: string },
): Promise<Goal> {
  const awaitingUserAction =
    turn.run?.status === "awaiting_approval"
      ? "approval"
      : turn.run?.status === "awaiting_input"
        ? "question"
        : undefined;

  if (awaitingUserAction) {
    const { goal: waiting } = await goalService.recordIteration({
      goalId: goal.id,
      iteration: {
        surface: "agent",
        summary: turn.output || "Waiting for a person",
        evidence: [],
        producedEvidence: false,
        calledTool: true,
        awaitingUserAction,
      },
    });

    return waiting;
  }

  if (turn.run?.status === "succeeded" && turn.output) {
    return goalService.transition({
      goalId: goal.id,
      actor: "model",
      status: "completed",
      reason: turn.output.slice(0, 2000),
    });
  }

  return goal;
}
