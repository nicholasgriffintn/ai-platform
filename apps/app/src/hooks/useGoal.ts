import type { Goal } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { apiService } from "~/lib/api/api-service";
import { useChatStore } from "~/state/stores/chatStore";

export const GOAL_QUERY_KEY = "goal";
const ACTIVE_GOAL_REFETCH_MS = 2_000;

export function goalRefetchInterval(goal: Pick<Goal, "status"> | null | undefined): number | false {
  return goal?.status === "active" ? ACTIVE_GOAL_REFETCH_MS : false;
}

export function useGoal(
  conversationId?: string,
  options?: { enabled?: boolean; refetchInterval?: number },
) {
  const queryClient = useQueryClient();
  const isPro = useChatStore((state) => state.isPro);
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isLocalModel = useChatStore((state) => state.chatMode === "local");
  const isAwaitingRemoteConversation = useChatStore((state) =>
    Boolean(conversationId && state.locallyCreatedConversationIds[conversationId]),
  );
  const enabled =
    Boolean(conversationId) &&
    !isAwaitingRemoteConversation &&
    !isLocalModel &&
    isPro &&
    isAuthenticated &&
    options?.enabled !== false;

  const query = useQuery<Goal | null>({
    queryKey: [GOAL_QUERY_KEY, conversationId],
    queryFn: () => apiService.getConversationGoal(conversationId as string),
    enabled,
    retry: false,
    staleTime: 15_000,
    refetchInterval:
      options?.refetchInterval ?? ((currentQuery) => goalRefetchInterval(currentQuery.state.data)),
    refetchIntervalInBackground: true,
  });

  const writeGoal = useCallback(
    (goal: Goal | null) => {
      queryClient.setQueryData([GOAL_QUERY_KEY, conversationId], goal);
    },
    [conversationId, queryClient],
  );

  const setGoal = useMutation({
    mutationFn: (objective: string) =>
      apiService.setConversationGoal(conversationId as string, objective),
    onSuccess: writeGoal,
  });

  const updateGoal = useMutation({
    mutationFn: (status: "active" | "paused" | "cleared") =>
      apiService.updateConversationGoal(conversationId as string, status),
    onSuccess: (goal) => writeGoal(goal?.status === "cleared" ? null : goal),
  });

  return {
    goal: query.data ?? null,
    isLoadingGoal: query.isLoading,
    canUseGoals: isPro && isAuthenticated && !isLocalModel,
    setGoal,
    updateGoal,
    writeGoal,
  };
}
