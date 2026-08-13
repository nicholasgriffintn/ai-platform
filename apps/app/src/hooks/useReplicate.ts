import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	fetchReplicateModels,
	executeReplicateModel,
	fetchReplicatePredictions,
	fetchReplicatePrediction,
} from "~/lib/api/replicate";
import type { ExecuteReplicateRequest, ReplicatePrediction } from "@ngriffin_uk/polychat-schemas";

const REPLICATE_QUERY_KEY = "replicate";
const REPLICATE_MODELS_STALE_TIME = 30 * 60 * 1000;
const REPLICATE_STATUS_STALE_TIME = 30 * 1000;
const ACTIVE_REPLICATE_PREDICTION_STATUSES = new Set([
	"processing",
	"queued",
	"in_progress",
	"starting",
]);

const replicatePredictionQueryKey = (projectId?: string, predictionId?: string | null) => [
	REPLICATE_QUERY_KEY,
	projectId,
	"prediction",
	predictionId,
];

export function useReplicateModels(projectId?: string) {
	return useQuery({
		queryKey: [REPLICATE_QUERY_KEY, projectId, "models"],
		queryFn: () => fetchReplicateModels(projectId),
		staleTime: REPLICATE_MODELS_STALE_TIME,
	});
}

export function useReplicatePredictions(projectId?: string) {
	return useQuery({
		queryKey: [REPLICATE_QUERY_KEY, projectId, "predictions"],
		queryFn: () => fetchReplicatePredictions(projectId),
		staleTime: REPLICATE_STATUS_STALE_TIME,
		refetchInterval: (query) => {
			const data = query.state.data as ReplicatePrediction[] | undefined;
			if (!data) return false;

			const hasActivePredictions = data.some((pred) =>
				ACTIVE_REPLICATE_PREDICTION_STATUSES.has(String(pred.status).toLowerCase()),
			);
			return hasActivePredictions ? 10000 : false;
		},
	});
}

export function useReplicatePrediction(predictionId: string | null, projectId?: string) {
	return useQuery({
		queryKey: replicatePredictionQueryKey(projectId, predictionId),
		queryFn: () => fetchReplicatePrediction(predictionId!, projectId),
		enabled: !!predictionId,
		staleTime: REPLICATE_STATUS_STALE_TIME,
		refetchInterval: (query) => {
			const data = query.state.data as ReplicatePrediction | undefined;
			if (!data) return false;

			return ACTIVE_REPLICATE_PREDICTION_STATUSES.has(String(data.status).toLowerCase())
				? 10000
				: false;
		},
	});
}

export function useExecuteReplicateModel(projectId?: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (request: ExecuteReplicateRequest) => executeReplicateModel(request, projectId),
		onSuccess: (prediction) => {
			queryClient.setQueryData(replicatePredictionQueryKey(projectId, prediction.id), prediction);
			queryClient.invalidateQueries({
				queryKey: [REPLICATE_QUERY_KEY, projectId, "predictions"],
			});
		},
	});
}
