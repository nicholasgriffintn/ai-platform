import {
  addNotebookSources,
  createNotebookNote,
  exportOutputContent,
  getNotebookSceneImage,
  getNotebook,
  getStudyProgress,
  listNotebooks,
  promoteNotebookNote,
  removeNotebookSource,
  researchForNotebook,
  saveStudyProgress,
  startNotebookStudio,
  updateNotebook,
} from "@ngriffin_uk/polychat-library-client";
import type {
  CreateNotebookNoteInput,
  LinkNotebookSourcesInput,
  NotebookDetail,
  NotebookResearchInput,
  NotebookStudioRequestInput,
  StudyProgress,
  UpdateNotebookInput,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { hasPendingNotebookWork } from "../lib/notebooks.js";

export const NOTEBOOKS_QUERY_KEY = "notebooks";
const PENDING_POLL_INTERVAL = 5_000;
const EMPTY_SCENE_IMAGES: (Blob | null)[] = [];

export const notebookQueryKeys = {
  list: (projectId?: string) => [NOTEBOOKS_QUERY_KEY, "list", projectId ?? "personal"] as const,
  detail: (notebookId: string) => [NOTEBOOKS_QUERY_KEY, "detail", notebookId] as const,
  progress: (notebookId: string, outputId: string) =>
    [NOTEBOOKS_QUERY_KEY, "progress", notebookId, outputId] as const,
};

export function useNotebooks(projectId?: string, enabled = true) {
  return useQuery({
    queryKey: notebookQueryKeys.list(projectId),
    queryFn: () => listNotebooks(projectId),
    enabled,
  });
}

export function useNotebook(notebookId: string) {
  return useQuery({
    queryKey: notebookQueryKeys.detail(notebookId),
    queryFn: () => getNotebook(notebookId),
    enabled: Boolean(notebookId),
    refetchInterval: (query) =>
      query.state.data && hasPendingNotebookWork(query.state.data) ? PENDING_POLL_INTERVAL : false,
  });
}

export function useNotebookActions(notebookId: string) {
  const queryClient = useQueryClient();
  const detailKey = notebookQueryKeys.detail(notebookId);
  const store = (detail: NotebookDetail) => queryClient.setQueryData(detailKey, detail);
  const refresh = () => queryClient.invalidateQueries({ queryKey: [NOTEBOOKS_QUERY_KEY] });

  const update = useMutation({
    mutationFn: (input: UpdateNotebookInput) => updateNotebook(notebookId, input),
    onSuccess: refresh,
  });
  const addSources = useMutation({
    mutationFn: (input: LinkNotebookSourcesInput) => addNotebookSources(notebookId, input),
    onSuccess: store,
  });
  const removeSource = useMutation({
    mutationFn: (sourceId: string) => removeNotebookSource(notebookId, sourceId),
    onSuccess: store,
  });
  const addNote = useMutation({
    mutationFn: (input: CreateNotebookNoteInput) => createNotebookNote(notebookId, input),
    onSuccess: refresh,
  });
  const promoteNote = useMutation({
    mutationFn: (noteId: string) => promoteNotebookNote(notebookId, noteId),
    onSuccess: store,
  });
  const research = useMutation({
    mutationFn: (input: NotebookResearchInput) => researchForNotebook(notebookId, input),
    onSuccess: (response) => (response.depth === "deep" ? refresh() : undefined),
  });
  const studio = useMutation({
    mutationFn: (input: NotebookStudioRequestInput) => startNotebookStudio(notebookId, input),
    onSuccess: refresh,
  });

  return { update, addSources, removeSource, addNote, promoteNote, research, studio };
}

export function useStudyProgress(notebookId: string, outputId: string) {
  const queryClient = useQueryClient();
  const queryKey = notebookQueryKeys.progress(notebookId, outputId);
  const query = useQuery({
    queryKey,
    queryFn: () => getStudyProgress(notebookId, outputId),
    enabled: Boolean(notebookId && outputId),
  });
  const save = useMutation({
    mutationFn: (progress: StudyProgress) => saveStudyProgress(notebookId, outputId, progress),
    onMutate: (progress) => queryClient.setQueryData(queryKey, progress),
  });

  return { query, save };
}

export function useVideoOverviewMedia(params: {
  notebookId: string;
  outputId: string;
  sceneHasImage: readonly boolean[];
  hasNarration: boolean;
}) {
  const { notebookId, outputId, sceneHasImage, hasNarration } = params;
  const query = useQuery({
    queryKey: [NOTEBOOKS_QUERY_KEY, "video-media", outputId, sceneHasImage.join(","), hasNarration],
    enabled: Boolean(notebookId && outputId),
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      const [narration, sceneImages] = await Promise.all([
        hasNarration
          ? exportOutputContent(outputId).then((file) => file.blob)
          : Promise.resolve(null),
        Promise.all(
          sceneHasImage.map((hasImage, index) =>
            hasImage
              ? getNotebookSceneImage(notebookId, outputId, index).catch(() => null)
              : Promise.resolve(null),
          ),
        ),
      ]);

      return { narration, sceneImages };
    },
  });

  return {
    narration: query.data?.narration ?? null,
    sceneImages: query.data?.sceneImages ?? EMPTY_SCENE_IMAGES,
    isLoading: query.isLoading,
  };
}
