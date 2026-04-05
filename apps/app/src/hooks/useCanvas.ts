import { useMutation, useQuery } from "@tanstack/react-query";

import { fetchCanvasModels, generateCanvasOutputs } from "~/lib/api/canvas";
import type { CanvasGenerateRequest, CanvasMode } from "~/types/canvas";

export const CANVAS_QUERY_KEY = "canvas";

export function useCanvasModels(mode: CanvasMode) {
	return useQuery({
		queryKey: [CANVAS_QUERY_KEY, "models", mode],
		queryFn: () => fetchCanvasModels(mode),
		staleTime: 1000 * 60 * 5,
	});
}

export function useGenerateCanvasOutputs() {
	return useMutation({
		mutationFn: (request: CanvasGenerateRequest) =>
			generateCanvasOutputs(request),
	});
}
