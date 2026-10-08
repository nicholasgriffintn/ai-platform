import type { ConversationFollowUpQueue } from "@ngriffin_uk/polychat-component-conversation";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useQueuedFollowUps } from "@ngriffin_uk/polychat-library-react";
import { useMemo } from "react";

export function useChatFollowUpQueue(
  conversationId: string | undefined,
): ConversationFollowUpQueue | undefined {
  const model = useChatStore((state) => state.model);
  const { canQueue, queued, queue, remove } = useQueuedFollowUps(conversationId);

  return useMemo(() => {
    if (!canQueue) {
      return undefined;
    }

    return {
      messages: queued,
      onQueue: async (content: string) => {
        await queue.mutateAsync({ content, request: model ? { model } : {} });
      },
      onRemove: (queuedId: string) => remove.mutate(queuedId),
    };
  }, [canQueue, model, queue, queued, remove]);
}
