import { defineStatusMachine, isTaskError } from "@ngriffin_uk/polychat-library-tasks";
import {
  PROJECT_TASK_ACTOR_TRANSITIONS,
  TERMINAL_PROJECT_TASK_STATUSES,
  type Goal,
  type GoalStatus,
  type ProjectTaskActor,
  type ProjectTaskBlockedReason,
  type ProjectTaskStatus,
} from "@ngriffin_uk/polychat-schemas";

import { fromTaskError } from "~/utils/errors";

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

export const projectTaskStatusMachine = defineStatusMachine<ProjectTaskStatus, ProjectTaskActor>({
  terminal: TERMINAL_PROJECT_TASK_STATUSES,
  allowed: PROJECT_TASK_ACTOR_TRANSITIONS,
  reopenBy: ["user"],
  describeRefusal: ({ actor, from, to }) => {
    if (actor === "model" && to === "done") {
      return "A task is accepted by a person, not by the assistant. Move it to review instead.";
    }

    if (TERMINAL_PROJECT_TASK_STATUSES.includes(from) && actor !== "user") {
      return "This task is already finished and only a person can reopen it";
    }

    return undefined;
  },
});

export function assertProjectTaskTransition(params: {
  actor: ProjectTaskActor;
  from: ProjectTaskStatus;
  to: ProjectTaskStatus;
}): void {
  try {
    projectTaskStatusMachine.assertTransition(params);
  } catch (error) {
    throw isTaskError(error) ? fromTaskError(error) : error;
  }
}

export function isRunnableStatus(status: ProjectTaskStatus): boolean {
  return status === "backlog" || status === "blocked" || status === "review";
}
