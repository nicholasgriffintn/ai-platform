import { defineStatusMachine, isTaskError } from "@ngriffin_uk/polychat-library-tasks";
import type { GoalStatus } from "@ngriffin_uk/polychat-schemas";

import { GoalError } from "./errors.js";

export type GoalActor = "user" | "model" | "system";

export const TERMINAL_GOAL_STATUSES: readonly GoalStatus[] = [
  "completed",
  "cleared",
  "blocked",
  "stalled",
  "limit_reached",
];

export function isTerminalGoalStatus(status: GoalStatus): boolean {
  return TERMINAL_GOAL_STATUSES.includes(status);
}

const goalStatusMachine = defineStatusMachine<GoalStatus, GoalActor>({
  terminal: TERMINAL_GOAL_STATUSES,
  allowed: {
    user: ["active", "paused", "cleared"],
    model: ["completed"],
    system: ["blocked", "stalled", "limit_reached"],
  },
  describeRefusal: ({ actor, from, to }) =>
    isTerminalGoalStatus(from)
      ? `This goal already ended as ${from}`
      : `A ${actor} may not move a goal to ${to}`,
});

export interface GoalTransition {
  actor: GoalActor;
  from: GoalStatus;
  to: GoalStatus;
}

export function assertGoalTransition(transition: GoalTransition): void {
  try {
    goalStatusMachine.assertTransition(transition);
  } catch (error) {
    if (isTaskError(error, "forbidden_transition")) {
      throw new GoalError("forbidden_transition", error.message, { ...transition });
    }

    throw error;
  }
}
