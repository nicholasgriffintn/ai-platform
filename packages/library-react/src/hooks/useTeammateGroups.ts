import { apiService } from "@ngriffin_uk/polychat-library-client";
import type { CreateTeammateGroupInput, TeammateGroup } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { TEAMMATE_ROSTER_QUERY_KEY } from "../lib/teammates/roster.js";

export const TEAMMATE_GROUPS_QUERY_KEY = ["teammate-groups"] as const;

export function useTeammateGroups({ enabled = true }: { enabled?: boolean } = {}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: TEAMMATE_GROUPS_QUERY_KEY,
    queryFn: () => apiService.listTeammateGroups(),
    enabled,
    staleTime: 60_000,
  });
  const create = useMutation<TeammateGroup, Error, CreateTeammateGroupInput>({
    mutationFn: (input) => apiService.createTeammateGroup(input),
    onSuccess: (created) => {
      queryClient.setQueryData<TeammateGroup[]>(TEAMMATE_GROUPS_QUERY_KEY, (current = []) => [
        created,
        ...current.filter((group) => group.conversationId !== created.conversationId),
      ]);
      void queryClient.invalidateQueries({ queryKey: TEAMMATE_ROSTER_QUERY_KEY });
    },
  });

  return { ...query, groups: query.data ?? [], create };
}

export function useTeammateGroup(conversationId: string | undefined): TeammateGroup | undefined {
  const { groups } = useTeammateGroups({ enabled: Boolean(conversationId) });

  return groups.find((group) => group.conversationId === conversationId);
}
