import { getLocalChatScope } from "@ngriffin_uk/polychat-library-chat";
import type { Conversation } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import {
  CHATS_QUERY_KEY,
  apiService,
  applyResponseReplay,
  replaceConversationResponseSnapshot,
  type AuthoritativeResponseSnapshot,
  type ResponseReplayState,
  useChatStore,
  useSyncStore,
} from "@ngriffin_uk/polychat-library-client";
import { isTerminalResponseStatus, type PlatformResponse } from "@ngriffin_uk/polychat-schemas";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { updateConversationInChatCaches } from "../conversation-cache.js";

const INITIAL_REPLAY_INTERVAL_MS = 2_000;
const MAX_REPLAY_INTERVAL_MS = 30_000;

export function useResponseReplay(
  conversationId: string | undefined,
  latestResponse: PlatformResponse | null | undefined,
  enabled: boolean,
) {
  const queryClient = useQueryClient();
  const userId = useChatStore((state) => state.user?.id);
  const statesRef = useRef<Record<string, ResponseReplayState>>({});
  const latestResponseRef = useRef(latestResponse);
  const latestResponseId = latestResponse?.id;
  const latestResponseStatus = latestResponse?.status;

  useEffect(() => {
    latestResponseRef.current = latestResponse;
  }, [latestResponse]);

  useEffect(() => {
    if (
      !enabled ||
      !conversationId ||
      !latestResponseId ||
      !latestResponseStatus ||
      isTerminalResponseStatus(latestResponseStatus)
    ) {
      return undefined;
    }

    let disposed = false;
    let synchronising = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let replayIntervalMs = INITIAL_REPLAY_INTERVAL_MS;
    const abortController = new AbortController();
    const responseId = latestResponseId;

    const publish = (snapshot: AuthoritativeResponseSnapshot) => {
      updateConversationInChatCaches<Conversation>(
        queryClient,
        conversationId,
        (conversation) => replaceConversationResponseSnapshot(conversation, snapshot),
        CHATS_QUERY_KEY,
        getLocalChatScope(userId),
      );
    };

    const schedule = (response: PlatformResponse, progressed: boolean) => {
      if (disposed || isTerminalResponseStatus(response.status)) {
        return;
      }

      if (useSyncStore.getState().status === "open") {
        return;
      }

      replayIntervalMs = progressed
        ? INITIAL_REPLAY_INTERVAL_MS
        : Math.min(replayIntervalMs * 2, MAX_REPLAY_INTERVAL_MS);
      timer = setTimeout(() => void synchronise(), replayIntervalMs);
    };

    const synchronise = async () => {
      if (synchronising) {
        return;
      }

      synchronising = true;

      try {
        let state = statesRef.current[responseId];

        if (!state) {
          const snapshot = await apiService.getResponseSnapshot(responseId, abortController.signal);

          if (disposed) {
            return;
          }

          state = { cursor: snapshot.cursor, snapshot };
          statesRef.current[responseId] = state;
          publish(snapshot);
          schedule(snapshot, true);

          return;
        }

        const previousCursor = state.cursor;
        const previousUpdatedAt = state.snapshot.updated_at;
        const replay = await apiService.getResponseEvents(
          responseId,
          state.cursor,
          undefined,
          abortController.signal,
        );

        if (disposed) {
          return;
        }

        const outcome = applyResponseReplay(state, replay);

        if (outcome.requiresSnapshot) {
          const snapshot = await apiService.getResponseSnapshot(responseId, abortController.signal);

          if (disposed) {
            return;
          }

          state = { cursor: snapshot.cursor, snapshot };
        } else {
          state = outcome.state;
        }

        if (isTerminalResponseStatus(state.snapshot.status)) {
          const snapshot = await apiService.getResponseSnapshot(responseId, abortController.signal);

          if (disposed) {
            return;
          }

          state = { cursor: snapshot.cursor, snapshot };
        }

        statesRef.current[responseId] = state;
        publish(state.snapshot);
        schedule(
          state.snapshot,
          state.cursor !== previousCursor || state.snapshot.updated_at !== previousUpdatedAt,
        );
      } catch {
        if (disposed || abortController.signal.aborted) {
          return;
        }

        const current = statesRef.current[responseId]?.snapshot ?? latestResponseRef.current;

        if (current?.id === responseId) {
          schedule(current, false);
        }
      } finally {
        synchronising = false;
      }
    };

    void synchronise();

    const watchedTopics = new Set([`conversation:${conversationId}`, `response:${responseId}`]);
    const unsubscribe = useSyncStore.subscribe((state, previous) => {
      if (disposed) {
        return;
      }

      const reconnected = state.status !== previous.status && state.status === "open";
      const relevantEvent =
        state.lastEventAt !== previous.lastEventAt &&
        state.lastEventTopic !== null &&
        watchedTopics.has(state.lastEventTopic);

      if (reconnected || relevantEvent) {
        void synchronise();
      }
    });

    return () => {
      disposed = true;
      unsubscribe();
      abortController.abort();
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [conversationId, enabled, latestResponseId, latestResponseStatus, queryClient, userId]);
}
