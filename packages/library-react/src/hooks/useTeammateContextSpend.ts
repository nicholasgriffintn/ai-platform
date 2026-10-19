import { apiService } from "@ngriffin_uk/polychat-library-client";
import type { TeammateContext } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { teammateContextQueryKey } from "./useTeammateContexts.js";

export const teammateContextSpendQueryKey = (contextId: string) =>
  ["teammate-context-spend", contextId] as const;

export function useTeammateContextSpend(contextId: string | undefined) {
  return useQuery({
    queryKey: teammateContextSpendQueryKey(contextId ?? ""),
    queryFn: () => apiService.getTeammateContextSpend(contextId ?? ""),
    enabled: Boolean(contextId),
    staleTime: 60 * 1000,
  });
}

export function useUpdateTeammateContextBudget() {
  const queryClient = useQueryClient();

  return useMutation<
    TeammateContext,
    Error,
    { contextId: string; monthlyCreditCapMicros: number | null }
  >({
    mutationFn: ({ contextId, monthlyCreditCapMicros }) =>
      apiService.updateTeammateContextBudget(contextId, monthlyCreditCapMicros),
    onSuccess: (updated) => {
      queryClient.setQueryData<TeammateContext[]>(
        teammateContextQueryKey(updated.teammateId),
        (current = []) => current.map((item) => (item.id === updated.id ? updated : item)),
      );
      void queryClient.invalidateQueries({ queryKey: teammateContextSpendQueryKey(updated.id) });
    },
  });
}
