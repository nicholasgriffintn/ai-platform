import { useMutation, useQuery } from "@tanstack/react-query";

import {
	fetchCanvasGenerations,
	fetchCanvasModels,
	generateCanvasOutputs,
} from "~/lib/api/canvas";
import type {
	CanvasGenerateRequest,
	CanvasGeneration,
	CanvasMode,
} from "~/types/canvas";

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

export function useCanvasGenerations(mode?: CanvasMode) {
	return useQuery({
		queryKey: [CANVAS_QUERY_KEY, "generations", mode ?? "all"],
		queryFn: () => fetchCanvasGenerations(mode),
		refetchInterval: (query) => {
			const data = query.state.data as CanvasGeneration[] | undefined;
			if (!data?.length) {
				return false;
			}

			const hasActiveGeneration = data.some((generation) =>
				["queued", "processing"].includes(generation.status),
			);

			return hasActiveGeneration ? 10000 : false;
		},
	});
}
