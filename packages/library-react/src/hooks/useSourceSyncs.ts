import {
  createSourceSync,
  deleteSourceSync,
  listSourceSyncs,
  updateSourceSync,
} from "@ngriffin_uk/polychat-library-client";
import type { CreateSourceSyncInput } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { SOURCE_QUERY_KEYS } from "./useSources.js";

export function useSourceSyncs(projectId?: string) {
  return useQuery({
    queryKey: ["sources", "syncs", projectId],
    queryFn: () => listSourceSyncs(projectId),
    refetchInterval: 15000,
  });
}

export function useSourceSyncMutations() {
  const client = useQueryClient();
  const invalidate = () => client.invalidateQueries({ queryKey: SOURCE_QUERY_KEYS.all });

  return {
    create: useMutation({
      mutationFn: (input: CreateSourceSyncInput) => createSourceSync(input),
      onSuccess: invalidate,
    }),
    update: useMutation({ mutationFn: updateSourceSync, onSuccess: invalidate }),
    remove: useMutation({ mutationFn: deleteSourceSync, onSuccess: invalidate }),
  };
}
