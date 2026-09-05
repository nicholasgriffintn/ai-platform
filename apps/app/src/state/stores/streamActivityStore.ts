import {
  applyStreamActivityState,
  applyStreamActivityText,
  completeStreamActivityTool,
  createStreamActivity,
  type StreamActivity,
} from "@ngriffin_uk/polychat-library-chat/response-stats";
import {
  applyTurnActivityEvent,
  createTurnActivityProjection,
  markTurnActivityReconnecting,
  type TurnActivityProjection,
} from "@ngriffin_uk/polychat-library-chat/turn-activity";
import type { ChatTurnActivityEvent } from "@ngriffin_uk/polychat-schemas/chat-stream";
import { create } from "zustand";

import { keepLatestRecordEntries } from "~/lib/collections";

const MAX_TRACKED_RESPONSE_DURATIONS = 100;

export interface ConversationStreamState {
  activity: StreamActivity | null;
  controller?: AbortController;
  loadingMessage: string;
  messageStartedAt: number | null;
  requiresAction: boolean;
  status: "streaming" | "action-required";
  source?: "local" | "remote";
  turnActivity: TurnActivityProjection | null;
}

interface StreamActivityStore {
  streams: Record<string, ConversationStreamState>;
  responseDurations: Record<string, number>;
  beginStreamActivity: (
    conversationId: string,
    controller?: AbortController,
    loadingMessage?: string,
    source?: "local" | "remote",
  ) => void;
  recordStreamActivityState: (conversationId: string, state: string, data?: unknown) => void;
  recordTurnActivity: (conversationId: string, event: ChatTurnActivityEvent) => void;
  markStreamActivityReconnecting: (conversationId: string) => void;
  recordStreamActivityText: (
    conversationId: string,
    text: { content?: unknown; reasoning?: unknown },
  ) => void;
  recordStreamActivityToolResult: (
    conversationId: string,
    toolResult: { toolCallId?: string; name?: string; status?: string },
  ) => void;
  completeStreamActivityMessage: (conversationId: string, messageId?: string) => void;
  updateStreamLoadingMessage: (conversationId: string, loadingMessage: string) => void;
  endStreamActivity: (conversationId: string) => void;
  clearStreamStatus: (conversationId: string) => void;
}

export const useStreamActivityStore = create<StreamActivityStore>()((set) => ({
  streams: {},
  responseDurations: {},
  beginStreamActivity: (
    conversationId,
    controller,
    loadingMessage = "Generating response...",
    source = "local",
  ) => {
    const startedAt = Date.now();

    set((current) => ({
      streams: {
        ...current.streams,
        [conversationId]: {
          activity: createStreamActivity(startedAt),
          controller,
          loadingMessage,
          messageStartedAt: startedAt,
          requiresAction: false,
          status: "streaming",
          source,
          turnActivity: null,
        },
      },
    }));
  },
  recordStreamActivityState: (conversationId, state, data) =>
    set((current) => {
      const stream = current.streams[conversationId];

      if (!stream?.activity) {
        return current;
      }

      return {
        streams: {
          ...current.streams,
          [conversationId]: {
            ...stream,
            activity: applyStreamActivityState(stream.activity, state, data, Date.now()),
          },
        },
      };
    }),
  recordTurnActivity: (conversationId, event) =>
    set((current) => {
      const stream = current.streams[conversationId];

      if (!stream) {
        return current;
      }

      const turnActivity = applyTurnActivityEvent(
        stream.turnActivity ?? createTurnActivityProjection(),
        event,
      );

      return {
        streams: {
          ...current.streams,
          [conversationId]: {
            ...stream,
            loadingMessage: turnActivity.label,
            requiresAction: stream.requiresAction || turnActivity.requiresAction,
            turnActivity,
          },
        },
      };
    }),
  markStreamActivityReconnecting: (conversationId) =>
    set((current) => {
      const stream = current.streams[conversationId];

      if (!stream) {
        return current;
      }

      const turnActivity = markTurnActivityReconnecting(stream.turnActivity);

      return {
        streams: {
          ...current.streams,
          [conversationId]: {
            ...stream,
            loadingMessage: turnActivity.label,
            turnActivity,
          },
        },
      };
    }),
  recordStreamActivityText: (conversationId, text) =>
    set((current) => {
      const stream = current.streams[conversationId];

      if (!stream?.activity) {
        return current;
      }

      return {
        streams: {
          ...current.streams,
          [conversationId]: {
            ...stream,
            activity: applyStreamActivityText(stream.activity, text),
          },
        },
      };
    }),
  recordStreamActivityToolResult: (conversationId, toolResult) =>
    set((current) => {
      const stream = current.streams[conversationId];

      if (!stream?.activity) {
        return current;
      }

      return {
        streams: {
          ...current.streams,
          [conversationId]: {
            ...stream,
            activity: completeStreamActivityTool(stream.activity, toolResult, Date.now()),
            requiresAction: stream.requiresAction || toolResult.status === "pending",
          },
        },
      };
    }),
  completeStreamActivityMessage: (conversationId, messageId) =>
    set((current) => {
      const stream = current.streams[conversationId];

      if (!stream?.activity) {
        return current;
      }

      const completedAt = Date.now();
      const startedAt = stream.messageStartedAt ?? stream.activity.startedAt;
      const updatedStream = { ...stream, messageStartedAt: completedAt };

      if (!messageId) {
        return {
          streams: { ...current.streams, [conversationId]: updatedStream },
        };
      }

      return {
        streams: { ...current.streams, [conversationId]: updatedStream },
        responseDurations: keepLatestRecordEntries(
          {
            ...current.responseDurations,
            [messageId]: completedAt - startedAt,
          },
          MAX_TRACKED_RESPONSE_DURATIONS,
        ),
      };
    }),
  updateStreamLoadingMessage: (conversationId, loadingMessage) =>
    set((current) => {
      const stream = current.streams[conversationId];

      if (!stream || stream.loadingMessage === loadingMessage) {
        return current;
      }

      return {
        streams: {
          ...current.streams,
          [conversationId]: { ...stream, loadingMessage },
        },
      };
    }),
  endStreamActivity: (conversationId) =>
    set((current) => {
      const stream = current.streams[conversationId];

      if (!stream) {
        return current;
      }

      if (stream.requiresAction) {
        return {
          streams: {
            ...current.streams,
            [conversationId]: {
              ...stream,
              activity: null,
              controller: undefined,
              messageStartedAt: null,
              status: "action-required",
              turnActivity: stream.turnActivity,
            },
          },
        };
      }

      const { [conversationId]: _finished, ...remainingStreams } = current.streams;

      return { streams: remainingStreams };
    }),
  clearStreamStatus: (conversationId) =>
    set((current) => {
      if (!current.streams[conversationId]) {
        return current;
      }

      const { [conversationId]: _cleared, ...remainingStreams } = current.streams;

      return { streams: remainingStreams };
    }),
}));
