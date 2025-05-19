import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchDrawing,
  fetchDrawings,
  generateImageFromDrawing,
  guessDrawingFromImage,
} from "~/lib/api/drawings";
import type {
  Drawing,
  GenerateImageResponse,
  GuessResponse,
} from "~/types/drawing";

export const useFetchDrawings = () => {
  return useQuery<Drawing[], Error>({
    queryKey: ["drawings"],
    queryFn: fetchDrawings,
  });
};

export const useFetchDrawing = (id: string | undefined) => {
  return useQuery<Drawing, Error>({
    queryKey: ["drawing", id],
    queryFn: () => fetchDrawing(id!),
    enabled: !!id,
  });
};

export const useGenerateDrawing = () => {
  const queryClient = useQueryClient();
  return useMutation<
    GenerateImageResponse,
    Error,
    { drawing: File; drawingId?: string }
  >({
    mutationFn: (data) => generateImageFromDrawing(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drawings"] });
    },
  });
};

export const useGuessDrawing = () => {
  return useMutation<GuessResponse, Error, { drawing: File }>({
    mutationFn: (data) => guessDrawingFromImage(data),
  });
};
