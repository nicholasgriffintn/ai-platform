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

export const useFetchDrawings = (enabled = true) => {
  return useQuery<Drawing[]>({
    queryKey: ["drawings"],
    queryFn: fetchDrawings,
    enabled,
  });
};

export const useFetchDrawing = (id: string | undefined) => {
  return useQuery<Drawing>({
    queryKey: ["drawing", id],
    queryFn: () => fetchDrawing(id!),
    enabled: !!id,
  });
};

export const useGenerateDrawing = () => {
  const queryClient = useQueryClient();

  return useMutation<GenerateImageResponse, Error, { drawing: File; drawingId?: string }>({
    mutationFn: (data) => generateImageFromDrawing(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["drawings"] });
    },
  });
};

export const useGuessDrawing = () => {
  return useMutation<GuessResponse, Error, { drawing: File }>({
    mutationFn: (data) => guessDrawingFromImage(data),
  });
};
