import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	fetchReplicateModels,
	executeReplicateModel,
	fetchReplicatePredictions,
	fetchReplicatePrediction,
} from "~/lib/api/replicate";
import type { ExecuteReplicateRequest, ReplicatePrediction } from "@assistant/schemas";

const REPLICATE_QUERY_KEY = "replicate";

export function useReplicateModels(projectId?: string) {
	return useQuery({
		queryKey: [REPLICATE_QUERY_KEY, projectId, "models"],
		queryFn: () => fetchReplicateModels(projectId),
		staleTime: 1000 * 60 * 5, // 5 minutes
	});
}

export function useReplicatePredictions(projectId?: string) {
	return useQuery({
		queryKey: [REPLICATE_QUERY_KEY, projectId, "predictions"],
		queryFn: () => fetchReplicatePredictions(projectId),
		refetchInterval: (query) => {
			const data = query.state.data as ReplicatePrediction[] | undefined;
			if (!data) return false;

			const activeStatuses = new Set(["processing", "queued", "in_progress", "starting"]);
			const hasActivePredictions = data.some((pred) =>
				activeStatuses.has(String(pred.status).toLowerCase()),
			);
			return hasActivePredictions ? 10000 : false;
		},
	});
}

export function useReplicatePrediction(predictionId: string | null, projectId?: string) {
	return useQuery({
		queryKey: [REPLICATE_QUERY_KEY, projectId, "prediction", predictionId],
		queryFn: () => fetchReplicatePrediction(predictionId!, projectId),
		enabled: !!predictionId,
		refetchInterval: (query) => {
			const data = query.state.data as ReplicatePrediction | undefined;
			if (!data) return false;

			return data.status === "processing" ? 10000 : false;
		},
	});
}

export function useExecuteReplicateModel(projectId?: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (request: ExecuteReplicateRequest) => executeReplicateModel(request, projectId),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: [REPLICATE_QUERY_KEY, projectId, "predictions"],
			});
		},
	});
}
