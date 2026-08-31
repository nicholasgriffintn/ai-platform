import {
  canActorSetProjectTaskStatus,
  isTerminalProjectTaskStatus,
  type Goal,
  type GoalStatus,
  type ProjectTaskActor,
  type ProjectTaskBlockedReason,
  type ProjectTaskStatus,
} from "@ngriffin_uk/polychat-schemas";

import { AssistantError, ErrorType } from "~/utils/errors";

export interface ProjectTaskStatusProjection {
  status: ProjectTaskStatus;
  blockedReason: ProjectTaskBlockedReason | null;
}

const GOAL_STATUS_PROJECTION: Record<GoalStatus, ProjectTaskStatusProjection> = {
  active: { status: "running", blockedReason: null },
  paused: { status: "queued", blockedReason: null },
  completed: { status: "review", blockedReason: null },
  cleared: { status: "cancelled", blockedReason: null },
  blocked: { status: "blocked", blockedReason: "stalled" },
  stalled: { status: "blocked", blockedReason: "stalled" },
  limit_reached: { status: "blocked", blockedReason: "usage_limits" },
};

export function projectTaskStatusForGoal(goal: Pick<Goal, "status">): ProjectTaskStatusProjection {
  return GOAL_STATUS_PROJECTION[goal.status];
}

export function assertProjectTaskTransition(params: {
  actor: ProjectTaskActor;
  from: ProjectTaskStatus;
  to: ProjectTaskStatus;
}): void {
  if (params.from === params.to) {
    return;
  }

  if (!canActorSetProjectTaskStatus(params.actor, params.to)) {
    throw new AssistantError(
      params.actor === "model" && params.to === "done"
        ? "A task is accepted by a person, not by the assistant. Move it to review instead."
        : `A ${params.actor} cannot move a task to ${params.to}`,
      ErrorType.FORBIDDEN,
      403,
    );
  }

  if (isTerminalProjectTaskStatus(params.from) && params.actor !== "user") {
    throw new AssistantError(
      "This task is already finished and only a person can reopen it",
      ErrorType.FORBIDDEN,
      403,
    );
  }
}

export function isRunnableStatus(status: ProjectTaskStatus): boolean {
  return status === "backlog" || status === "blocked" || status === "review";
}
