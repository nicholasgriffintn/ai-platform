import { listKnowledgeSyncs, controlKnowledgeSync } from "@ngriffin_uk/polychat-library-client";
import type { UpdateKnowledgeSync } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { SOURCE_QUERY_KEYS } from "./useSources.js";

export function useKnowledgeSyncs(projectId: string) {
  return useQuery({
    queryKey: ["knowledge-syncs", projectId],
    queryFn: () => listKnowledgeSyncs(projectId),
    enabled: Boolean(projectId),
    refetchInterval: 60_000,
  });
}

export function useKnowledgeSyncControl(projectId: string) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: UpdateKnowledgeSync["action"] }) =>
      controlKnowledgeSync(id, { action }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["knowledge-syncs", projectId] }),
        client.invalidateQueries({ queryKey: SOURCE_QUERY_KEYS.all }),
      ]);
    },
  });
}
