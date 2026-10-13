import { useStreamActivityStore } from "@ngriffin_uk/polychat-library-client";
import {
  isTerminalResponseStatus,
  type PlatformResponse,
  type ThreadOperation,
} from "@ngriffin_uk/polychat-schemas";
import { useEffect } from "react";

import { getResponseLoadingMessage } from "../chat/response-presentation.js";

export function useRemoteConversationActivity(
  conversationId: string | undefined,
  activeOperation: ThreadOperation | null | undefined,
  latestResponse: PlatformResponse | null | undefined,
) {
  const stream = useStreamActivityStore((state) =>
    conversationId ? state.streams[conversationId] : undefined,
  );

  useEffect(() => {
    if (!conversationId || (stream && stream.source !== "remote")) {
      return;
    }

    const store = useStreamActivityStore.getState();
    const responseActive = latestResponse && !isTerminalResponseStatus(latestResponse.status);
    const loadingMessage = responseActive
      ? getResponseLoadingMessage(latestResponse.status)
      : undefined;

    if (activeOperation || responseActive) {
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
  }, [conversationId, activeOperation, latestResponse, stream]);
}
