import { goalStatusLabels, type GoalMarkerEvent } from "@ngriffin_uk/polychat-schemas/goals";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

export interface GoalMessageMarker {
  label: string;
  objective?: string;
}

const EVENT_LABELS: Record<GoalMarkerEvent, string> = {
  set: "Goal set",
  paused: goalStatusLabels.paused,
  resumed: "Goal resumed",
  cleared: goalStatusLabels.cleared,
  completed: goalStatusLabels.completed,
  blocked: goalStatusLabels.blocked,
  stalled: goalStatusLabels.stalled,
  limit_reached: goalStatusLabels.limit_reached,
  steered: "Goal steered",
};

export function getGoalMessageMarker(message: unknown): GoalMessageMarker | null {
  if (!isRecord(message) || !Array.isArray(message.parts)) {
    return null;
  }

  const goalPart = message.parts.find((part) => isRecord(part) && part.type === "goal");

  if (!isRecord(goalPart)) {
    return null;
  }

  const event = typeof goalPart.event === "string" ? goalPart.event : undefined;
  const label =
    (typeof goalPart.label === "string" && goalPart.label.trim()) ||
    (event && event in EVENT_LABELS ? EVENT_LABELS[event as GoalMarkerEvent] : undefined);

  if (!label) {
    return null;
  }

  return {
    label,
    objective: typeof goalPart.objective === "string" ? goalPart.objective : undefined,
  };
}
