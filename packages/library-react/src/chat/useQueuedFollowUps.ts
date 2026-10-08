import { apiService, CHATS_QUERY_KEY, useChatStore } from "@ngriffin_uk/polychat-library-client";
import type { QueuedChatMessage, QueuedChatRequest } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function queuedFollowUpsQueryKey(conversationId: string | undefined) {
  return [CHATS_QUERY_KEY, conversationId, "queued-messages"] as const;
}

export function useQueuedFollowUps(
  conversationId: string | undefined,
  options: { enabled?: boolean } = {},
) {
  const queryClient = useQueryClient();
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isHosted = useChatStore((state) => state.computeSite === "hosted");
  const isAwaitingRemoteConversation = useChatStore((state) =>
    Boolean(conversationId && state.locallyCreatedConversationIds[conversationId]),
  );
  const enabled =
    Boolean(conversationId) &&
    isAuthenticated &&
    isHosted &&
    !isAwaitingRemoteConversation &&
    options.enabled !== false;
  const queryKey = queuedFollowUpsQueryKey(conversationId);
  const requireConversationId = () => {
    if (!conversationId) {
      throw new Error("Open a saved conversation before queueing a message");
    }

    return conversationId;
  };

  const query = useQuery<QueuedChatMessage[]>({
    queryKey,
    queryFn: () => apiService.listQueuedChatMessages(requireConversationId()),
    enabled,
    retry: false,
    staleTime: 10_000,
  });

  const queue = useMutation({
    mutationFn: (input: { content: string; request?: QueuedChatRequest }) =>
      apiService.queueChatMessage(requireConversationId(), {
        message: { role: "user", content: input.content },
        request: input.request ?? {},
      }),
    onSuccess: (queued) => {
      queryClient.setQueryData<QueuedChatMessage[]>(queryKey, (current = []) => [
        ...current.filter((item) => item.id !== queued.id),
        queued,
      ]);
    },
  });

  const remove = useMutation({
    mutationFn: (queuedId: string) =>
      apiService.removeQueuedChatMessage(requireConversationId(), queuedId),
    onMutate: (queuedId) => {
      queryClient.setQueryData<QueuedChatMessage[]>(queryKey, (current = []) =>
        current.filter((item) => item.id !== queuedId),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    canQueue: enabled,
    queued: query.data ?? [],
    queue,
    remove,
  };
}
