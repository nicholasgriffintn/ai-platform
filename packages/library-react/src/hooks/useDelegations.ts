import {
  cancelConversationDelegations,
  listConversationDelegations,
} from "@ngriffin_uk/polychat-library-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const conversationDelegationsQueryKey = (conversationId: string) =>
  ["conversation-delegations", conversationId] as const;

export function useDelegations(conversationId: string) {
  return useQuery({
    queryKey: conversationDelegationsQueryKey(conversationId),
    queryFn: () => listConversationDelegations(conversationId),
    enabled: Boolean(conversationId),
    refetchInterval: 2_000,
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
