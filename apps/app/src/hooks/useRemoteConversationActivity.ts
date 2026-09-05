import {
  isTerminalChatRunStatus,
  type ChatRun,
  type ThreadOperation,
} from "@ngriffin_uk/polychat-schemas";
import { useEffect } from "react";

import { getChatRunLoadingMessage } from "~/lib/chat/run-presentation";
import { useStreamActivityStore } from "~/state/stores/streamActivityStore";

export function useRemoteConversationActivity(
  conversationId: string | undefined,
  activeOperation: ThreadOperation | null | undefined,
  latestRun: ChatRun | null | undefined,
) {
  const stream = useStreamActivityStore((state) =>
    conversationId ? state.streams[conversationId] : undefined,
  );

  useEffect(() => {
    if (!conversationId || (stream && stream.source !== "remote")) {
      return;
    }

    const store = useStreamActivityStore.getState();
    const runActive = latestRun && !isTerminalChatRunStatus(latestRun.status);
    const loadingMessage = runActive ? getChatRunLoadingMessage(latestRun.status) : undefined;

    if (activeOperation || runActive) {
      if (!stream) {
        store.beginStreamActivity(
          conversationId,
          undefined,
          loadingMessage ?? "Waiting for the response...",
          "remote",
        );
      } else if (loadingMessage) {
        store.updateStreamLoadingMessage(conversationId, loadingMessage);
      }
    } else if (stream?.source === "remote") {
      store.clearStreamStatus(conversationId);
    }
  }, [conversationId, activeOperation, latestRun, stream]);
}
