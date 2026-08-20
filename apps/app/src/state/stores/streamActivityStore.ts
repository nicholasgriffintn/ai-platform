import {
  applyStreamActivityState,
  applyStreamActivityText,
  completeStreamActivityTool,
  createStreamActivity,
  type StreamActivity,
} from "@ngriffin_uk/polychat-library-chat/response-stats";
import { create } from "zustand";

const MAX_TRACKED_RESPONSE_DURATIONS = 100;

interface StreamActivityStore {
  activity: StreamActivity | null;
  messageStartedAt: number | null;
  responseDurations: Record<string, number>;
  beginStreamActivity: () => void;
  recordStreamActivityState: (state: string, data?: unknown) => void;
  recordStreamActivityText: (text: { content?: unknown; reasoning?: unknown }) => void;
  recordStreamActivityToolResult: (toolResult: { toolCallId?: string; name?: string }) => void;
  completeStreamActivityMessage: (messageId?: string) => void;
  endStreamActivity: () => void;
}

function trimResponseDurations(durations: Record<string, number>): Record<string, number> {
  const entries = Object.entries(durations);

  if (entries.length <= MAX_TRACKED_RESPONSE_DURATIONS) {
    return durations;
  }

  return Object.fromEntries(entries.slice(entries.length - MAX_TRACKED_RESPONSE_DURATIONS));
}

export const useStreamActivityStore = create<StreamActivityStore>()((set) => ({
  activity: null,
  messageStartedAt: null,
  responseDurations: {},
  beginStreamActivity: () => {
    const startedAt = Date.now();

    set({ activity: createStreamActivity(startedAt), messageStartedAt: startedAt });
  },
  recordStreamActivityState: (state, data) =>
    set((current) =>
      current.activity
        ? { activity: applyStreamActivityState(current.activity, state, data, Date.now()) }
        : current,
    ),
  recordStreamActivityText: (text) =>
    set((current) =>
      current.activity ? { activity: applyStreamActivityText(current.activity, text) } : current,
    ),
  recordStreamActivityToolResult: (toolResult) =>
    set((current) =>
      current.activity
        ? { activity: completeStreamActivityTool(current.activity, toolResult, Date.now()) }
        : current,
    ),
  completeStreamActivityMessage: (messageId) =>
    set((current) => {
      const completedAt = Date.now();

      if (!current.activity) {
        return current;
      }

      const startedAt = current.messageStartedAt ?? current.activity.startedAt;

      if (!messageId) {
        return { messageStartedAt: completedAt };
      }

      return {
        messageStartedAt: completedAt,
        responseDurations: trimResponseDurations({
          ...current.responseDurations,
          [messageId]: completedAt - startedAt,
        }),
      };
    }),
  endStreamActivity: () => set({ activity: null, messageStartedAt: null }),
}));
