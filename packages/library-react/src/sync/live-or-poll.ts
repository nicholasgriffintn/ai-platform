import { useSyncStore } from "@ngriffin_uk/polychat-library-client";
import type { DeviceSyncEventType } from "@ngriffin_uk/polychat-schemas";
import { useCallback } from "react";

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
  "workspace_usage.changed",
  "document_comments.changed",
  "output.changed",
  "model_platform.changed",
  "knowledge_sync.changed",
  "project_review.changed",
  "channel_senders.changed",
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
  status = useSyncStore.getState().status,
  liveInterval: PollInterval = false,
): PollInterval {
  const fallback = typeof interval === "function" ? interval(query) : interval;

  if (status === "open" && isLiveEventType(coveredBy)) {
    return fallback ? liveInterval : fallback;
  }

  return fallback;
}

export function useLiveOrPoll() {
  const status = useSyncStore((state) => state.status);

  return useCallback(
    <TQuery>(
      query: TQuery,
      interval: PollInterval | ((query: TQuery) => PollInterval),
      coveredBy: DeviceSyncEventType,
      liveInterval: PollInterval = false,
    ): PollInterval => liveOrPoll(query, interval, coveredBy, status, liveInterval),
    [status],
  );
}
