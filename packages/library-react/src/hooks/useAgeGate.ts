import {
  confirmAge,
  getAgeGate,
  useAgeGatePromptStore,
  useChatStore,
} from "@ngriffin_uk/polychat-library-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

export const AGE_GATE_QUERY_KEY = ["auth", "age"] as const;

function useAgeGateQueryKey() {
  const userId = useChatStore((state) => state.user?.id ?? null);

  return useMemo(() => [...AGE_GATE_QUERY_KEY, userId], [userId]);
}

export function useAgeGate() {
  const queryClient = useQueryClient();
  const queryKey = useAgeGateQueryKey();

  const query = useQuery({
    queryKey,
    queryFn: getAgeGate,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const confirmation = useMutation({
    mutationFn: confirmAge,
    onSuccess: (response) => {
      queryClient.setQueryData(queryKey, response);
    },
  });

  return {
    status: query.data?.status,
    confirm: confirmation.mutateAsync,
    isConfirming: confirmation.isPending,
    confirmError: confirmation.error,
    resetConfirmError: confirmation.reset,
  };
}

export function useEnsureAgeConfirmed() {
  const queryClient = useQueryClient();
  const queryKey = useAgeGateQueryKey();

  return useCallback(async () => {
    const response = await queryClient
      .fetchQuery({ queryKey, queryFn: getAgeGate, staleTime: Number.POSITIVE_INFINITY })
      .catch(() => null);

    if (!response || response.status === "not_required" || response.status === "adult") {
      return true;
    }

    return useAgeGatePromptStore.getState().requestConfirmation();
  }, [queryClient, queryKey]);
}
