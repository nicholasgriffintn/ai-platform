import {
  fetchDrawing,
  fetchDrawings,
  fetchReplicateModels,
  fetchReplicatePrediction,
  fetchReplicatePredictions,
  fetchStudioModels,
  guessDrawing,
  listStudioGenerations,
  paintDrawing,
  runReplicateModel,
  startStudioGeneration,
} from "@ngriffin_uk/polychat-library-client";
import type { ExecuteReplicateRequest } from "@ngriffin_uk/polychat-schemas";
import type { CanvasGenerateRequest, CanvasMode } from "@ngriffin_uk/polychat-schemas/experiences";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useLiveOrPoll } from "../sync/live-or-poll.js";

const ACTIVE_POLL_INTERVAL = 10_000;
const MODELS_STALE_TIME = 5 * 60 * 1000;

export const SOURCE_STUDIO_QUERY_KEYS = {
  models: (mode: CanvasMode) => ["source-models", "studio", mode] as const,
  replicateModels: ["source-models", "replicate"] as const,
  generations: (mode: CanvasMode | undefined, projectId?: string) =>
    ["sources", "studio", mode ?? "all", projectId ?? "personal"] as const,
  predictions: (projectId?: string) => ["sources", "predictions", projectId ?? "personal"] as const,
  prediction: (sourceId: string | null) => ["sources", "prediction", sourceId] as const,
  drawings: (projectId?: string) => ["sources", "drawings", projectId ?? "personal"] as const,
  drawing: (sourceId: string | undefined) => ["sources", "drawing", sourceId] as const,
};

const isActive = (status: string) => ["queued", "processing"].includes(status);

export function useCanvasModels(mode: CanvasMode, enabled = true) {
  return useQuery({
    queryKey: SOURCE_STUDIO_QUERY_KEYS.models(mode),
    queryFn: () => fetchStudioModels(mode),
    staleTime: MODELS_STALE_TIME,
    enabled,
  });
}

export function useGenerateCanvasOutputs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CanvasGenerateRequest) => startStudioGeneration(request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sources"] }),
  });
}

export function useCanvasGenerations(mode?: CanvasMode, enabled = true, projectId?: string) {
  const liveOrPoll = useLiveOrPoll();

  return useQuery({
    queryKey: SOURCE_STUDIO_QUERY_KEYS.generations(mode, projectId),
    queryFn: () => listStudioGenerations(mode, projectId),
    enabled,
    refetchInterval: (query) =>
      liveOrPoll(
        query,
        (current) =>
          current.state.data?.some((generation) => isActive(generation.status))
            ? ACTIVE_POLL_INTERVAL
            : false,
        "source.changed",
      ),
  });
}

export function useReplicateModels() {
  return useQuery({
    queryKey: SOURCE_STUDIO_QUERY_KEYS.replicateModels,
    queryFn: () => fetchReplicateModels(),
    staleTime: MODELS_STALE_TIME,
  });
}

export function useReplicatePredictions(projectId?: string) {
  const liveOrPoll = useLiveOrPoll();

  return useQuery({
    queryKey: SOURCE_STUDIO_QUERY_KEYS.predictions(projectId),
    queryFn: () => fetchReplicatePredictions(projectId),
    refetchInterval: (query) =>
      liveOrPoll(
        query,
        (current) =>
          current.state.data?.some((prediction) => isActive(prediction.status))
            ? ACTIVE_POLL_INTERVAL
            : false,
        "source.changed",
      ),
  });
}

export function useReplicatePrediction(sourceId: string | null) {
  const liveOrPoll = useLiveOrPoll();

  return useQuery({
    queryKey: SOURCE_STUDIO_QUERY_KEYS.prediction(sourceId),
    queryFn: () => fetchReplicatePrediction(sourceId!),
    enabled: Boolean(sourceId),
    refetchInterval: (query) =>
      liveOrPoll(
        query,
        (current) =>
          current.state.data && isActive(current.state.data.status) ? ACTIVE_POLL_INTERVAL : false,
        "source.changed",
      ),
  });
}

export function useExecuteReplicateModel(projectId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: ExecuteReplicateRequest) => runReplicateModel(request, projectId),
    onSuccess: (prediction) => {
      queryClient.setQueryData(SOURCE_STUDIO_QUERY_KEYS.prediction(prediction.id), prediction);
      void queryClient.invalidateQueries({ queryKey: ["sources"] });
    },
  });
}

export function useFetchDrawings(enabled = true, projectId?: string) {
  return useQuery({
    queryKey: SOURCE_STUDIO_QUERY_KEYS.drawings(projectId),
    queryFn: () => fetchDrawings(projectId),
    enabled,
  });
}

export function useFetchDrawing(sourceId: string | undefined) {
  return useQuery({
    queryKey: SOURCE_STUDIO_QUERY_KEYS.drawing(sourceId),
    queryFn: () => fetchDrawing(sourceId!),
    enabled: Boolean(sourceId),
  });
}

export function useGenerateDrawing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ drawing, projectId }: { drawing: File; projectId?: string }) =>
      paintDrawing(drawing, projectId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sources"] }),
  });
}

export function useGuessDrawing() {
  return useMutation({
    mutationFn: ({ drawing, projectId }: { drawing: File; projectId?: string }) =>
      guessDrawing(drawing, projectId),
  });
}
