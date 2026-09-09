import {
  fetchDrawing,
  fetchDrawings,
  generateImageFromDrawing,
  guessDrawingFromImage,
} from "@ngriffin_uk/polychat-library-client";
import type {
  Drawing,
  GenerateImageResponse,
  GuessResponse,
} from "@ngriffin_uk/polychat-schemas/experiences";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const useFetchDrawings = (enabled = true, projectId?: string) => {
  return useQuery<Drawing[]>({
    queryKey: ["drawings", projectId ?? "personal"],
    queryFn: () => fetchDrawings(projectId),
    enabled,
  });
};

export const useFetchDrawing = (id: string | undefined, projectId?: string) => {
  return useQuery<Drawing>({
    queryKey: ["drawing", id, projectId ?? "personal"],
    queryFn: () => fetchDrawing(id!, projectId),
    enabled: !!id,
  });
};

export const useGenerateDrawing = () => {
  const queryClient = useQueryClient();

  return useMutation<
    GenerateImageResponse,
    Error,
    { drawing: File; drawingId?: string; projectId?: string }
  >({
    mutationFn: (data) => generateImageFromDrawing(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["drawings"] });
    },
  });
};

export const useGuessDrawing = () => {
  return useMutation<GuessResponse, Error, { drawing: File; projectId?: string }>({
    mutationFn: (data) => guessDrawingFromImage(data),
  });
};
