import type { GoalStatus } from "@ngriffin_uk/polychat-schemas";

export const goalStatusLabels: Record<GoalStatus, string> = {
  active: "Goal active",
  paused: "Goal paused",
  completed: "Goal completed",
  cleared: "Goal cleared",
  blocked: "Goal blocked",
  stalled: "Goal stopped making progress",
  limit_reached: "Goal stopped at your usage limit",
};
