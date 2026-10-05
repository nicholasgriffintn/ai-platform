import {
  listKnowledgeConnections,
  createKnowledgeConnection,
  controlKnowledgeConnection,
  deleteKnowledgeConnection,
  searchConnectedKnowledge,
} from "@ngriffin_uk/polychat-library-client";
import type { CreateKnowledgeSync, KnowledgeSyncControl } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { SOURCE_QUERY_KEYS } from "./useSources.js";

export function useKnowledgeConnections(projectId?: string) {
  const client = useQueryClient();
  const queryKey = ["knowledge-connections", projectId];
  const query = useQuery({
    queryKey,
    queryFn: () => listKnowledgeConnections(projectId),
    refetchInterval: (state) =>
      state.state.data?.some(
        (sync) => sync.status === "syncing" || (sync.status === "idle" && !sync.lastSyncedAt),
      )
        ? 15_000
        : false,
  });
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey }),
      client.invalidateQueries({ queryKey: SOURCE_QUERY_KEYS.all }),
      client.invalidateQueries({ queryKey: ["knowledge-search", projectId] }),
    ]);
  const create = useMutation({
    mutationFn: (input: CreateKnowledgeSync) => createKnowledgeConnection(input),
    onSuccess: refresh,
  });
  const control = useMutation({
    mutationFn: ({ id, ...input }: KnowledgeSyncControl & { id: string }) =>
      controlKnowledgeConnection(id, input),
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: deleteKnowledgeConnection, onSuccess: refresh });

  return { query, create, control, remove };
}

export function useKnowledgeSearch(projectId: string | undefined, query: string) {
  return useQuery({
    queryKey: ["knowledge-search", projectId, query],
    queryFn: () => searchConnectedKnowledge({ projectId, query, limit: 5 }),
    enabled: query.length >= 2,
    staleTime: 0,
  });
}
