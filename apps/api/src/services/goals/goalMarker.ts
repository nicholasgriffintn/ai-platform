import { goalStatusLabels, type Goal, type GoalMarkerEvent } from "@ngriffin_uk/polychat-schemas";

import type { ConversationManager } from "~/lib/conversationManager";
import type { Message } from "~/types";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/goals/goalMarker" });

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

export const GOAL_STATUS_MARKER_EVENTS: Partial<Record<Goal["status"], GoalMarkerEvent>> = {
  completed: "completed",
  blocked: "blocked",
  stalled: "stalled",
  limit_reached: "limit_reached",
  paused: "paused",
  cleared: "cleared",
};

export function buildGoalMarkerMessage(params: {
  completionId: string;
  goal: Goal;
  event: GoalMarkerEvent;
}): Message {
  const label = EVENT_LABELS[params.event];
  const timestamp = Date.now();

  return {
    id: `${generateId()}-goal`,
    completion_id: params.completionId,
    role: "goal",
    content: label,
    parts: [
      {
        type: "goal",
        event: params.event,
        label,
        objective: params.goal.objective,
        timestamp,
      },
    ],
    timestamp,
  };
}

/**
 * Goal transitions are recorded in the transcript the way compaction is, so a
 * shared or exported conversation still carries the story of the objective.
 */
export async function recordGoalMarker(params: {
  conversationManager: Pick<ConversationManager, "add">;
  completionId: string;
  goal: Goal;
  event: GoalMarkerEvent;
}): Promise<Message | null> {
  const message = buildGoalMarkerMessage({
    completionId: params.completionId,
    goal: params.goal,
    event: params.event,
  });

  try {
    await params.conversationManager.add(params.completionId, message);

    return message;
  } catch (error) {
    logger.error("Failed to record the goal marker", { error, event: params.event });

    return null;
  }
}
