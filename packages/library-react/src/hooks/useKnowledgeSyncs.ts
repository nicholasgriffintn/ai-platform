import { listKnowledgeSyncs, controlKnowledgeSync } from "@ngriffin_uk/polychat-library-client";
import type { UpdateKnowledgeSync } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useLiveOrPoll } from "../sync/live-or-poll.js";
import { SOURCE_QUERY_KEYS } from "./useSources.js";

export function useKnowledgeSyncs(projectId: string) {
  const liveOrPoll = useLiveOrPoll();

  return useQuery({
    queryKey: ["knowledge-syncs", projectId],
    queryFn: () => listKnowledgeSyncs(projectId),
    enabled: Boolean(projectId),
    refetchInterval: (query) => liveOrPoll(query, 60_000, "knowledge_sync.changed"),
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
