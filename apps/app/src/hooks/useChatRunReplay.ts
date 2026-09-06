import { updateConversationInChatCaches } from "@ngriffin_uk/polychat-library-react/conversation-cache";
import { isTerminalChatRunStatus, type ChatRun } from "@ngriffin_uk/polychat-schemas";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { CHATS_QUERY_KEY } from "~/constants";
import { apiService } from "~/lib/api/api-service";
import {
  applyChatRunReplay,
  replaceConversationRunSnapshot,
  type AuthoritativeChatRunSnapshot,
  type ChatRunReplayState,
} from "~/lib/chat/run-replay";
import { getLocalChatScope } from "~/lib/local/local-chat-scope";
import { useChatStore } from "~/state/stores/chatStore";
import type { Conversation } from "~/types";

const INITIAL_REPLAY_INTERVAL_MS = 2_000;
const MAX_REPLAY_INTERVAL_MS = 30_000;

export function useChatRunReplay(
  conversationId: string | undefined,
  latestRun: ChatRun | null | undefined,
  enabled: boolean,
) {
  const queryClient = useQueryClient();
  const userId = useChatStore((state) => state.user?.id);
  const statesRef = useRef<Record<string, ChatRunReplayState>>({});
  const snapshotOnlyRef = useRef<Record<string, boolean>>({});
  const latestRunRef = useRef(latestRun);
  const latestRunId = latestRun?.id;
  const latestRunStatus = latestRun?.status;

  useEffect(() => {
    latestRunRef.current = latestRun;
  }, [latestRun]);

  useEffect(() => {
    if (
      !enabled ||
      !conversationId ||
      !latestRunId ||
      !latestRunStatus ||
      isTerminalChatRunStatus(latestRunStatus)
    ) {
      return undefined;
    }

    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let replayIntervalMs = INITIAL_REPLAY_INTERVAL_MS;
    const abortController = new AbortController();
    const runId = latestRunId;

    const publish = (snapshot: AuthoritativeChatRunSnapshot) => {
      updateConversationInChatCaches<Conversation>(
        queryClient,
        conversationId,
        (conversation) => replaceConversationRunSnapshot(conversation, snapshot),
        CHATS_QUERY_KEY,
        getLocalChatScope(userId),
      );
    };

    const schedule = (run: ChatRun, progressed: boolean) => {
      if (!disposed && !isTerminalChatRunStatus(run.status)) {
        replayIntervalMs = progressed
          ? INITIAL_REPLAY_INTERVAL_MS
          : Math.min(replayIntervalMs * 2, MAX_REPLAY_INTERVAL_MS);
        timer = setTimeout(() => void synchronise(), replayIntervalMs);
      }
    };

    const synchronise = async () => {
      try {
        if (snapshotOnlyRef.current[runId]) {
          const legacy = await apiService.getChatRun(runId, abortController.signal);

          if (disposed) {
            return;
          }

          const currentCursor = statesRef.current[runId]?.cursor ?? 0;
          const previousRun = statesRef.current[runId]?.snapshot.run;
          const snapshot: AuthoritativeChatRunSnapshot = {
            protocolVersion: 1,
            cursor: currentCursor,
            ...legacy,
          };

          publish(snapshot);
          schedule(
            snapshot.run,
            previousRun?.status !== snapshot.run.status ||
              previousRun?.updatedAt !== snapshot.run.updatedAt,
          );

          return;
        }

        let state = statesRef.current[runId];

        if (!state) {
          const snapshot = await apiService.getChatRunSnapshot(runId, abortController.signal);

          if (disposed) {
            return;
          }

          state = { cursor: snapshot.cursor, snapshot };
          statesRef.current[runId] = state;
          publish(snapshot);
          schedule(snapshot.run, true);

          return;
        }

        const previousCursor = state.cursor;
        const previousUpdatedAt = state.snapshot.run.updatedAt;
        const replay = await apiService.getChatRunEvents(
          runId,
          state.cursor,
          undefined,
          abortController.signal,
        );

        if (disposed) {
          return;
        }

        const outcome = applyChatRunReplay(state, replay);

        if (outcome.requiresSnapshot) {
          if (outcome.unsupportedProtocol) {
            snapshotOnlyRef.current[runId] = true;
          }

          const snapshot = await apiService.getChatRunSnapshot(runId, abortController.signal);

          if (disposed) {
            return;
          }

          state = { cursor: snapshot.cursor, snapshot };
        } else {
          state = outcome.state;
        }

        if (isTerminalChatRunStatus(state.snapshot.run.status)) {
          const snapshot = await apiService.getChatRunSnapshot(runId, abortController.signal);

          if (disposed) {
            return;
          }

          state = { cursor: snapshot.cursor, snapshot };
        }

        statesRef.current[runId] = state;
        publish(state.snapshot);
        schedule(
          state.snapshot.run,
          state.cursor !== previousCursor || state.snapshot.run.updatedAt !== previousUpdatedAt,
        );
      } catch {
        if (disposed || abortController.signal.aborted) {
          return;
        }

        const currentRun = statesRef.current[runId]?.snapshot.run ?? latestRunRef.current;

        if (currentRun?.id === runId) {
          schedule(currentRun, false);
        }
      }
    };

    void synchronise();

    return () => {
      disposed = true;
      abortController.abort();
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [conversationId, enabled, latestRunId, latestRunStatus, queryClient, userId]);
}
