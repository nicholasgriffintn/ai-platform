import { listKnowledgeSyncs, controlKnowledgeSync } from "@ngriffin_uk/polychat-library-client";
import type { UpdateKnowledgeSync } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useLiveOrPoll } from "../sync/live-or-poll.js";
import { SOURCE_QUERY_KEYS } from "./useSources.js";

export type KnowledgeSyncTarget = { projectId: string } | { notebookId: string };

function targetKey(target: KnowledgeSyncTarget) {
  return ["knowledge-syncs", "projectId" in target ? target.projectId : target.notebookId] as const;
}

export function useKnowledgeSyncs(target: KnowledgeSyncTarget) {
  const liveOrPoll = useLiveOrPoll();

  return useQuery({
    queryKey: targetKey(target),
    queryFn: () => listKnowledgeSyncs(target),
    enabled: "projectId" in target ? Boolean(target.projectId) : Boolean(target.notebookId),
    refetchInterval: (query) => liveOrPoll(query, 60_000, "knowledge_sync.changed"),
  });
}

export function useKnowledgeSyncControl(target: KnowledgeSyncTarget) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: UpdateKnowledgeSync["action"] }) =>
      controlKnowledgeSync(id, { action }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: targetKey(target) }),
        client.invalidateQueries({ queryKey: SOURCE_QUERY_KEYS.all }),
      ]);
    },
  });
}
