import { goalStatusLabels, type GoalMarkerEvent } from "@ngriffin_uk/polychat-schemas/goals";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import type { Message } from "./conversation-types";

export interface GoalMessageMarker {
  event?: GoalMarkerEvent;
  label: string;
  objective?: string;
}

const EVENT_LABELS: Record<GoalMarkerEvent, string> = {
  set: "Goal started",
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
    event: event && event in EVENT_LABELS ? (event as GoalMarkerEvent) : undefined,
    label,
    objective: typeof goalPart.objective === "string" ? goalPart.objective : undefined,
  };
}

export function createGoalMarkerMessage(params: {
  event: GoalMarkerEvent;
  objective: string;
  id?: string;
  timestamp?: number;
}): Message {
  const timestamp = params.timestamp ?? Date.now();
  const label = EVENT_LABELS[params.event];

  return {
    id: params.id ?? crypto.randomUUID(),
    role: "goal",
    content: label,
    created: timestamp,
    timestamp,
    parts: [
      {
        type: "goal",
        event: params.event,
        label,
        objective: params.objective,
        timestamp,
      },
    ],
  };
}
