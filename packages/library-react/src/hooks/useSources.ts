import {
  addCollectionSources,
  apiService,
  createSource,
  createSourceCollection,
  createSourceCover,
  draftNotesFromMedia,
  enrichSource,
  formatSourceText,
  listSourceRevisions,
  restoreSourceRevision,
  startFolderStudio,
  updateSourceCollection,
  deleteSource,
  deleteSourceCollection,
  disablePodcastFeed,
  enablePodcastFeed,
  generatePodcast,
  getSource,
  listCollectionSources,
  listSourceCollections,
  listSources,
  listProjectContextSources,
  setProjectContextSources,
  searchProjectKnowledge,
  transcribeSource,
  listenToSource,
  updateSource,
  writeSourceNotes,
} from "@ngriffin_uk/polychat-library-client";
import {
  readSourceListen,
  readSourceMedia,
  type CreateSourceCollectionInput,
  type CreateSourceInput,
  type EnrichSourceInput,
  type FolderStudioRequest,
  type GenerateNotesFromMediaInput,
  type GeneratePodcastRequest,
  type RestoreSourceRevisionInput,
  type UpdateSourceCollectionInput,
  type UpdateSourceInput,
  type Source,
  type SourceGenerationType,
  type SourceKind,
  type SourceSummary,
  type UploadFileType,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useLiveOrPoll } from "../sync/live-or-poll.js";
import { OUTPUT_QUERY_KEYS } from "./useOutputs.js";

const PROCESSING_POLL_INTERVAL = 10_000;

/** Whether a source is still being generated, or has a transcript in progress. */
export function isSourceProcessing(source: Pick<SourceSummary, "status" | "metadata">): boolean {
  return (
    source.status === "processing" ||
    readSourceMedia(source.metadata).transcript?.status === "processing" ||
    readSourceListen(source.metadata)?.status === "making"
  );
}

export const SOURCE_QUERY_KEYS = {
  all: ["sources"] as const,
  list: (
    projectId?: string,
    kind?: SourceKind,
    collectionId?: string | null,
    generation?: SourceGenerationType,
  ) => ["sources", "list", projectId, kind, collectionId, generation] as const,
  detail: (sourceId: string | null) => ["sources", "detail", sourceId] as const,
  lists: ["sources", "list"] as const,
  revisions: (sourceId: string) => ["sources", "revisions", sourceId] as const,
  collections: (projectId?: string) => ["sources", "collections", projectId] as const,
  projectContext: (projectId: string) => ["sources", "project-context", projectId] as const,
};

export function useSources(
  filters: {
    projectId?: string;
    kind?: SourceKind;
    collectionId?: string | null;
    generation?: SourceGenerationType;
  } = {},
  options: { enabled?: boolean } = {},
) {
  const liveOrPoll = useLiveOrPoll();

  return useQuery({
    queryKey: SOURCE_QUERY_KEYS.list(
      filters.projectId,
      filters.kind,
      filters.collectionId,
      filters.generation,
    ),
    queryFn: () =>
      filters.collectionId
        ? listCollectionSources(filters.collectionId)
        : listSources({
            projectId: filters.projectId,
            kind: filters.kind,
            generation: filters.generation,
          }),
    staleTime: 1000 * 60 * 5,
    enabled: options.enabled,
    refetchInterval: (query) =>
      liveOrPoll(
        query,
        (current) =>
          current.state.data?.some(isSourceProcessing) ? PROCESSING_POLL_INTERVAL : false,
        "source.changed",
      ),
  });
}

export function useSource(sourceId: string | null) {
  const liveOrPoll = useLiveOrPoll();

  return useQuery({
    queryKey: SOURCE_QUERY_KEYS.detail(sourceId),
    queryFn: () => getSource(sourceId!),
    enabled: Boolean(sourceId),
    refetchInterval: (query) =>
      liveOrPoll(
        query,
        (current) =>
          current.state.data && isSourceProcessing(current.state.data)
            ? PROCESSING_POLL_INTERVAL
            : false,
        "source.changed",
      ),
  });
}

export function useSourceCollections(projectId?: string) {
  return useQuery({
    queryKey: SOURCE_QUERY_KEYS.collections(projectId),
    queryFn: () => listSourceCollections(projectId),
  });
}

export function useProjectKnowledgeSearch(projectId: string, query: string) {
  return useQuery({
    queryKey: ["sources", "search", projectId, query],
    queryFn: () => searchProjectKnowledge({ projectId, query, top_k: 10 }),
    enabled: Boolean(projectId && query.trim()),
    staleTime: 0,
  });
}

export function useProjectContextSources(projectId: string) {
  return useQuery({
    queryKey: SOURCE_QUERY_KEYS.projectContext(projectId),
    queryFn: () => listProjectContextSources(projectId),
    enabled: Boolean(projectId),
  });
}

export function useSetProjectContextSources(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sourceIds: string[]) => setProjectContextSources(projectId, sourceIds),
    onSuccess: (sources) => {
      queryClient.setQueryData(SOURCE_QUERY_KEYS.projectContext(projectId), sources);
      void queryClient.invalidateQueries({ queryKey: SOURCE_QUERY_KEYS.collections(projectId) });
    },
  });
}

export function useSourceMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: SOURCE_QUERY_KEYS.all });

  return {
    createSource: useMutation({
      mutationFn: (input: CreateSourceInput) => createSource(input),
      onSuccess: invalidate,
    }),
    renameSource: useMutation({
      mutationFn: ({ sourceId, title }: { sourceId: string; title: string }) =>
        updateSource(sourceId, { title }),
      onSuccess: invalidate,
    }),
    deleteSource: useMutation({
      mutationFn: deleteSource,
      onSuccess: invalidate,
    }),
    createCollection: useMutation({
      mutationFn: (input: CreateSourceCollectionInput) => createSourceCollection(input),
      onSuccess: invalidate,
    }),
    deleteCollection: useMutation({
      mutationFn: deleteSourceCollection,
      onSuccess: invalidate,
    }),
    addToCollection: useMutation({
      mutationFn: ({ collectionId, sourceId }: { collectionId: string; sourceId: string }) =>
        addCollectionSources(collectionId, [sourceId]),
      onSuccess: invalidate,
    }),
    uploadFile: useMutation({
      mutationFn: ({
        file,
        fileType,
        projectId,
      }: {
        file: File;
        fileType: UploadFileType;
        projectId?: string;
      }) => apiService.uploadFile(file, fileType, { projectId }),
      onSuccess: invalidate,
    }),
  };
}

export function useSourceMediaActions(sourceId: string) {
  const queryClient = useQueryClient();
  const onSuccess = (source: Source) => {
    queryClient.setQueryData(SOURCE_QUERY_KEYS.detail(source.id), source);
    void queryClient.invalidateQueries({ queryKey: SOURCE_QUERY_KEYS.all });
  };

  return {
    transcribe: useMutation({ mutationFn: () => transcribeSource(sourceId), onSuccess }),
    listen: useMutation({ mutationFn: () => listenToSource(sourceId), onSuccess }),
    writeNotes: useMutation({
      mutationFn: (speakers?: Record<string, string>) => writeSourceNotes(sourceId, speakers),
      onSuccess,
    }),
    createCover: useMutation({
      mutationFn: (prompt?: string) => createSourceCover(sourceId, prompt),
      onSuccess,
    }),
  };
}

export function useGeneratePodcast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: GeneratePodcastRequest) => generatePodcast(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SOURCE_QUERY_KEYS.all }),
  });
}

export function usePodcastFeed() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: SOURCE_QUERY_KEYS.all });

  return {
    enable: useMutation({ mutationFn: enablePodcastFeed, onSuccess: invalidate }),
    disable: useMutation({ mutationFn: disablePodcastFeed, onSuccess: invalidate }),
  };
}

export function useSourceRevisions(sourceId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: SOURCE_QUERY_KEYS.revisions(sourceId),
    queryFn: () => listSourceRevisions(sourceId),
    enabled: options.enabled,
  });
}

export function useSourceEditing(sourceId: string) {
  const queryClient = useQueryClient();
  const onSaved = (source: Source) => {
    queryClient.setQueryData(SOURCE_QUERY_KEYS.detail(source.id), source);
    void queryClient.invalidateQueries({ queryKey: SOURCE_QUERY_KEYS.lists });
    void queryClient.invalidateQueries({ queryKey: SOURCE_QUERY_KEYS.revisions(source.id) });
  };

  return {
    save: useMutation({
      mutationFn: (input: UpdateSourceInput) => updateSource(sourceId, input),
      onSuccess: onSaved,
    }),
    restore: useMutation({
      mutationFn: (input: RestoreSourceRevisionInput) => restoreSourceRevision(sourceId, input),
      onSuccess: onSaved,
    }),
    format: useMutation({
      mutationFn: (prompt?: string) => formatSourceText(sourceId, prompt),
    }),
  };
}

export function useDraftNotesFromMedia() {
  return useMutation({
    mutationFn: (input: GenerateNotesFromMediaInput) => draftNotesFromMedia(input),
  });
}

export function useEnrichSource(sourceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: EnrichSourceInput) => enrichSource(sourceId, input),
    onSuccess: (source: Source) => {
      queryClient.setQueryData(SOURCE_QUERY_KEYS.detail(source.id), source);
      void queryClient.invalidateQueries({ queryKey: SOURCE_QUERY_KEYS.lists });
      void queryClient.invalidateQueries({ queryKey: ["knowledge", "document", source.id] });
    },
  });
}

export function useFolderActions(folderId: string) {
  const queryClient = useQueryClient();

  return {
    update: useMutation({
      mutationFn: (input: UpdateSourceCollectionInput) => updateSourceCollection(folderId, input),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: SOURCE_QUERY_KEYS.all }),
    }),
    studio: useMutation({
      mutationFn: (input: FolderStudioRequest) => startFolderStudio(folderId, input),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: SOURCE_QUERY_KEYS.all });
        void queryClient.invalidateQueries({ queryKey: OUTPUT_QUERY_KEYS.all });
      },
    }),
  };
}
