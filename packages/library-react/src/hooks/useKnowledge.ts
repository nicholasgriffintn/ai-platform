import {
  listKnowledgeIndexStatus,
  retryKnowledgeIndex,
  searchKnowledge,
} from "@ngriffin_uk/polychat-library-client";
import type { KnowledgeSearchInput } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { SOURCE_QUERY_KEYS } from "./useSources.js";

export function useKnowledgeIndexStatus(projectId?: string) {
  return useQuery({
    queryKey: ["sources", "index-status", projectId],
    queryFn: () => listKnowledgeIndexStatus(projectId),
    refetchInterval: (query) =>
      query.state.data?.some(
        (source) => source.status === "pending" || source.status === "indexing",
      )
        ? 5000
        : false,
  });
}

export function useKnowledgeSearch(projectId?: string) {
  return useMutation({
    mutationKey: ["sources", "search", projectId],
    mutationFn: (input: KnowledgeSearchInput) => searchKnowledge(input),
  });
}

export function useRetryKnowledgeIndex() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: retryKnowledgeIndex,
    onSuccess: () => client.invalidateQueries({ queryKey: SOURCE_QUERY_KEYS.all }),
  });
}
