import { useSyncStore } from "@ngriffin_uk/polychat-library-client";
import type { DeviceSyncEventType } from "@ngriffin_uk/polychat-schemas";

export type PollInterval = number | false | undefined;

const PUBLISHED_EVENT_TYPES = new Set<DeviceSyncEventType>([
  "conversation.changed",
  "conversation.deleted",
  "conversation.unread_changed",
  "run.changed",
  "run.event",
  "message.changed",
  "delegation.changed",
  "task.changed",
  "project_task.changed",
  "workbench_run.changed",
  "machine.changed",
  "usage.changed",
  "goal.changed",
  "connector_approval.changed",
  "attention.changed",
]);

export function isLiveEventType(type: DeviceSyncEventType): boolean {
  return PUBLISHED_EVENT_TYPES.has(type);
}

export function liveOrPoll<TQuery>(
  query: TQuery,
  interval: PollInterval | ((query: TQuery) => PollInterval),
  coveredBy: DeviceSyncEventType,
): PollInterval {
  if (useSyncStore.getState().status === "open" && isLiveEventType(coveredBy)) {
    return false;
  }

  return typeof interval === "function" ? interval(query) : interval;
}
