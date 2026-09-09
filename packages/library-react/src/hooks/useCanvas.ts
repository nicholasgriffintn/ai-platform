import {
  fetchCanvasGenerations,
  fetchCanvasModels,
  generateCanvasOutputs,
} from "@ngriffin_uk/polychat-library-client";
import type { CanvasGenerateRequest, CanvasMode } from "@ngriffin_uk/polychat-schemas/experiences";
import { useMutation, useQuery } from "@tanstack/react-query";

import { liveOrPoll } from "../sync/live-or-poll.js";

export const CANVAS_QUERY_KEY = "canvas";

export function useCanvasModels(mode: CanvasMode, enabled = true) {
  return useQuery({
    queryKey: [CANVAS_QUERY_KEY, "models", mode],
    queryFn: () => fetchCanvasModels(mode),
    staleTime: 1000 * 60 * 5,
    enabled,
  });
}

export function useGenerateCanvasOutputs() {
  return useMutation({
    mutationFn: (request: CanvasGenerateRequest) => generateCanvasOutputs(request),
  });
}

export function useCanvasGenerations(mode?: CanvasMode, enabled = true, projectId?: string) {
  return useQuery({
    queryKey: [CANVAS_QUERY_KEY, "generations", mode ?? "all", projectId ?? "personal"],
    queryFn: () => fetchCanvasGenerations(mode, projectId),
    enabled,
    refetchInterval: (query) =>
      liveOrPoll(
        query,
        (currentQuery) => {
          const data = currentQuery.state.data;

          if (!data?.length) {
            return false;
          }

          const hasActiveGeneration = data.some((generation) =>
            ["queued", "processing"].includes(generation.status),
          );

          return hasActiveGeneration ? 10000 : false;
        },
        "canvas.changed",
      ),
  });
}
