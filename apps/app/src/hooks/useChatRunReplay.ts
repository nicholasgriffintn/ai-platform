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

const REPLAY_INTERVAL_MS = 2_000;

export function useChatRunReplay(
  conversationId: string | undefined,
  latestRun: ChatRun | null | undefined,
  enabled: boolean,
) {
  const queryClient = useQueryClient();
  const userId = useChatStore((state) => state.user?.id);
  const statesRef = useRef<Record<string, ChatRunReplayState>>({});
  const snapshotOnlyRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (!enabled || !conversationId || !latestRun) {
      return undefined;
    }

    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const runId = latestRun.id;

    const publish = (snapshot: AuthoritativeChatRunSnapshot) => {
      updateConversationInChatCaches<Conversation>(
        queryClient,
        conversationId,
        (conversation) => replaceConversationRunSnapshot(conversation, snapshot),
        CHATS_QUERY_KEY,
        getLocalChatScope(userId),
      );
    };

    const schedule = (run: ChatRun) => {
      if (!disposed && !isTerminalChatRunStatus(run.status)) {
        timer = setTimeout(() => void synchronise(), REPLAY_INTERVAL_MS);
      }
    };

    const synchronise = async () => {
      try {
        if (snapshotOnlyRef.current[runId]) {
          const legacy = await apiService.getChatRun(runId);

          if (disposed) {
            return;
          }

          const currentCursor = statesRef.current[runId]?.cursor ?? 0;
          const snapshot: AuthoritativeChatRunSnapshot = {
            protocolVersion: 1,
            cursor: currentCursor,
            ...legacy,
          };

          publish(snapshot);
          schedule(snapshot.run);

          return;
        }

        let state = statesRef.current[runId];

        if (!state) {
          const snapshot = await apiService.getChatRunSnapshot(runId);

          if (disposed) {
            return;
          }

          state = { cursor: snapshot.cursor, snapshot };
          statesRef.current[runId] = state;
          publish(snapshot);
          schedule(snapshot.run);

          return;
        }

        const replay = await apiService.getChatRunEvents(runId, state.cursor);

        if (disposed) {
          return;
        }

        const outcome = applyChatRunReplay(state, replay);

        if (outcome.requiresSnapshot) {
          if (outcome.unsupportedProtocol) {
            snapshotOnlyRef.current[runId] = true;
          }

          const snapshot = await apiService.getChatRunSnapshot(runId);

          if (disposed) {
            return;
          }

          state = { cursor: snapshot.cursor, snapshot };
        } else {
          state = outcome.state;
        }

        statesRef.current[runId] = state;
        publish(state.snapshot);
        schedule(state.snapshot.run);
      } catch {
        schedule(statesRef.current[runId]?.snapshot.run ?? latestRun);
      }
    };

    void synchronise();

    return () => {
      disposed = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [conversationId, enabled, latestRun, queryClient, userId]);
}
