import { apiService } from "@ngriffin_uk/polychat-library-client";
import type { UpsertTeammateConnectionGrant } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const teammateConnectionGrantQueryKey = (contextId: string) =>
  ["teammate-connection-grants", contextId] as const;

export function useTeammateConnectionGrants(contextId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: teammateConnectionGrantQueryKey(contextId ?? ""),
    queryFn: () => apiService.listTeammateConnectionGrants(contextId ?? ""),
    enabled: Boolean(contextId),
  });
  const update = useMutation({
    mutationFn: (input: UpsertTeammateConnectionGrant) =>
      apiService.upsertTeammateConnectionGrant(contextId ?? "", input),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: teammateConnectionGrantQueryKey(contextId ?? ""),
      }),
  });

  return {
    ...query,
    grants: query.data?.grants ?? [],
    connections: query.data?.connections ?? [],
    update,
  };
}
