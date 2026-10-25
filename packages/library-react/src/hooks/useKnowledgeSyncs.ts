import {
  controlKnowledgeSync,
  createKnowledgeSync,
  deleteKnowledgeSync,
  listKnowledgeSyncs,
} from "@ngriffin_uk/polychat-library-client";
import {
  KNOWLEDGE_FEED_INTERVAL_MINUTES,
  type CreateFeedKnowledgeSync,
  type UpdateKnowledgeSync,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useLiveOrPoll } from "../sync/live-or-poll.js";
import { SOURCE_QUERY_KEYS } from "./useSources.js";

export type KnowledgeSyncTarget =
  | { projectId: string }
  | { notebookId: string }
  | { library: true };

function targetKey(target: KnowledgeSyncTarget) {
  return [
    "knowledge-syncs",
    "projectId" in target
      ? target.projectId
      : "notebookId" in target
        ? target.notebookId
        : "library",
  ] as const;
}

function targetDestination(target: KnowledgeSyncTarget) {
  return "library" in target ? {} : target;
}

function useInvalidateKnowledgeSyncs(target: KnowledgeSyncTarget) {
  const client = useQueryClient();

  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: targetKey(target) }),
      client.invalidateQueries({ queryKey: SOURCE_QUERY_KEYS.all }),
    ]);
}

export function useKnowledgeSyncs(target: KnowledgeSyncTarget) {
  const liveOrPoll = useLiveOrPoll();

  return useQuery({
    queryKey: targetKey(target),
    queryFn: () => listKnowledgeSyncs(target),
    enabled:
      "projectId" in target
        ? Boolean(target.projectId)
        : "notebookId" in target
          ? Boolean(target.notebookId)
          : true,
    refetchInterval: (query) => liveOrPoll(query, 60_000, "knowledge_sync.changed"),
  });
}

export function useKnowledgeSyncControl(target: KnowledgeSyncTarget) {
  const invalidate = useInvalidateKnowledgeSyncs(target);

  return useMutation({
    mutationFn: async ({
      id,
      action,
    }: {
      id: string;
      action: UpdateKnowledgeSync["action"] | "remove";
    }): Promise<void> => {
      if (action === "remove") {
        await deleteKnowledgeSync(id);
      } else {
        await controlKnowledgeSync(id, { action });
      }
    },
    onSuccess: invalidate,
  });
}

export function useKnowledgeFeedCreate(target: KnowledgeSyncTarget) {
  const invalidate = useInvalidateKnowledgeSyncs(target);

  return useMutation({
    mutationFn: (input: Pick<CreateFeedKnowledgeSync, "title" | "feed">) =>
      createKnowledgeSync({
        ...targetDestination(target),
        ...input,
        intervalMinutes: KNOWLEDGE_FEED_INTERVAL_MINUTES,
      }),
    onSuccess: invalidate,
  });
}
