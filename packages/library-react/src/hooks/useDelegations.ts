import { listConversationDelegations } from "@ngriffin_uk/polychat-library-client";
import { useQuery } from "@tanstack/react-query";

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
