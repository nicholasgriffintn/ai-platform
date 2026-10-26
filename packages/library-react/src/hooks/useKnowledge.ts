import {
  createKnowledgeSync,
  getKnowledgeDocumentState,
  getKnowledgeSettings,
  listKnowledgeDescriptors,
  reprocessKnowledgeDocument,
  setKnowledgeDocumentControls,
  updateKnowledgeSettings,
} from "@ngriffin_uk/polychat-library-client";
import type {
  CreateServiceKnowledgeSync,
  KnowledgeDocumentControls,
  UpdateKnowledgeSettings,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useLiveOrPoll } from "../sync/live-or-poll.js";
import { SOURCE_QUERY_KEYS } from "./useSources.js";

export const KNOWLEDGE_QUERY_KEYS = {
  document: (sourceId: string) => ["knowledge", "document", sourceId] as const,
  settings: (projectId?: string) => ["knowledge", "settings", projectId ?? "library"] as const,
  descriptors: (provider?: string) => ["knowledge", "descriptors", provider ?? "all"] as const,
};

export function useKnowledgeDocument(sourceId: string | null) {
  const liveOrPoll = useLiveOrPoll();

  return useQuery({
    queryKey: KNOWLEDGE_QUERY_KEYS.document(sourceId ?? ""),
    queryFn: () => getKnowledgeDocumentState(sourceId ?? ""),
    enabled: Boolean(sourceId),
    refetchInterval: (query) => liveOrPoll(query, 30_000, "knowledge.changed"),
  });
}

export function useKnowledgeDocumentActions(sourceId: string) {
  const client = useQueryClient();
  const settle = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: KNOWLEDGE_QUERY_KEYS.document(sourceId) }),
      client.invalidateQueries({ queryKey: SOURCE_QUERY_KEYS.all }),
    ]);
  };

  return {
    controls: useMutation({
      mutationFn: (controls: KnowledgeDocumentControls) =>
        setKnowledgeDocumentControls(sourceId, controls),
      onSuccess: settle,
    }),
    reprocess: useMutation({
      mutationFn: () => reprocessKnowledgeDocument(sourceId),
      onSuccess: settle,
    }),
  };
}

export function useKnowledgeSettings(projectId?: string) {
  return useQuery({
    queryKey: KNOWLEDGE_QUERY_KEYS.settings(projectId),
    queryFn: () => getKnowledgeSettings(projectId),
  });
}

export function useKnowledgeSettingsUpdate(projectId?: string) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<UpdateKnowledgeSettings, "project_id">) =>
      updateKnowledgeSettings({ ...input, ...(projectId ? { project_id: projectId } : {}) }),
    onSuccess: (settings) => {
      client.setQueryData(KNOWLEDGE_QUERY_KEYS.settings(projectId), settings);
    },
  });
}

export function useKnowledgeDescriptors(provider?: string) {
  return useQuery({
    queryKey: KNOWLEDGE_QUERY_KEYS.descriptors(provider),
    queryFn: () => listKnowledgeDescriptors(provider),
    staleTime: 10 * 60 * 1000,
  });
}

export function useKnowledgeServiceCreate() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateServiceKnowledgeSync) => createKnowledgeSync(input),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ["knowledge-syncs"] }),
        client.invalidateQueries({ queryKey: SOURCE_QUERY_KEYS.all }),
      ]),
  });
}
