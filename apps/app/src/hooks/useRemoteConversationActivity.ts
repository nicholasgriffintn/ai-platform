import type { ThreadOperation } from "@ngriffin_uk/polychat-schemas";
import { useEffect } from "react";

import { useStreamActivityStore } from "~/state/stores/streamActivityStore";

export function useRemoteConversationActivity(
  conversationId: string | undefined,
  activeOperation: ThreadOperation | null | undefined,
) {
  const stream = useStreamActivityStore((state) =>
    conversationId ? state.streams[conversationId] : undefined,
  );

  useEffect(() => {
    if (
      !conversationId ||
      activeOperation === undefined ||
      (stream && stream.source !== "remote")
    ) {
      return;
    }

    const store = useStreamActivityStore.getState();

    if (activeOperation) {
      if (!stream) {
        store.beginStreamActivity(
          conversationId,
          undefined,
          "Waiting for the response...",
          "remote",
        );
      }
    } else if (stream?.source === "remote") {
      store.clearStreamStatus(conversationId);
    }
  }, [conversationId, activeOperation, stream]);
}
