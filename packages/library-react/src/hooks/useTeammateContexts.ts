import { apiService } from "@ngriffin_uk/polychat-library-client";
import type { TeammateContext, TeammateContextScope } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const teammateContextQueryKey = (teammateId: string) =>
  ["teammate-contexts", teammateId] as const;

export function useTeammateContexts(teammateId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: teammateContextQueryKey(teammateId ?? ""),
    queryFn: () => apiService.listTeammateContexts(teammateId ?? ""),
    enabled: Boolean(teammateId),
  });
  const ensure = useMutation<
    TeammateContext,
    Error,
    { teammateId: string; scope: TeammateContextScope }
  >({
    mutationFn: ({ teammateId: id, scope }) => apiService.ensureTeammateContext(id, scope),
    onSuccess: (created) => {
      queryClient.setQueryData<TeammateContext[]>(
        teammateContextQueryKey(created.teammateId),
        (current = []) => [created, ...current.filter((item) => item.id !== created.id)],
      );
    },
  });

  const updateStatus = useMutation<
    TeammateContext,
    Error,
    { contextId: string; status: TeammateContext["status"] }
  >({
    mutationFn: ({ contextId, status }) =>
      apiService.updateTeammateContextStatus(contextId, status),
    onSuccess: (updated) => {
      queryClient.setQueryData<TeammateContext[]>(
        teammateContextQueryKey(updated.teammateId),
        (current = []) => current.map((item) => (item.id === updated.id ? updated : item)),
      );
    },
  });

  return { ...query, contexts: query.data ?? [], ensure, updateStatus };
}
