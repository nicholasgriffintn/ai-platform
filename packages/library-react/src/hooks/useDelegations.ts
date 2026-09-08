import {
  cancelConversationDelegations,
  listConversationHandles,
  listConversationDelegations,
  revokeConversationHandle,
} from "@ngriffin_uk/polychat-library-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { liveOrPoll } from "../sync/live-or-poll.js";

export const conversationDelegationsQueryKey = (conversationId: string) =>
  ["conversation-delegations", conversationId] as const;
export const conversationHandlesQueryKey = ["conversation-handles"] as const;

export function useDelegations(conversationId: string) {
  return useQuery({
    queryKey: conversationDelegationsQueryKey(conversationId),
    queryFn: () => listConversationDelegations(conversationId),
    enabled: Boolean(conversationId),
    refetchInterval: (query) => liveOrPoll(query, 2_000),
    refetchIntervalInBackground: true,
  });
}

export function useCancelDelegations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelConversationDelegations,
    onSuccess: (_response, conversationId) =>
      queryClient.invalidateQueries({ queryKey: conversationDelegationsQueryKey(conversationId) }),
  });
}

export function useConversationHandles(enabled = true) {
  const queryClient = useQueryClient();
  const handles = useQuery({
    queryKey: conversationHandlesQueryKey,
    queryFn: listConversationHandles,
    enabled,
  });
  const revoke = useMutation({
    mutationFn: revokeConversationHandle,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: conversationHandlesQueryKey }),
  });

  return { ...handles, revoke };
}
