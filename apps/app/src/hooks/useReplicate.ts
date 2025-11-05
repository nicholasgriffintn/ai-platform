import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	fetchReplicateModels,
	executeReplicateModel,
	fetchReplicatePredictions,
	fetchReplicatePrediction,
} from "~/lib/api/replicate";
import type {
	ExecuteReplicateRequest,
	ReplicatePrediction,
} from "~/types/replicate";

const REPLICATE_QUERY_KEY = "replicate";

export function useReplicateModels() {
	return useQuery({
		queryKey: [REPLICATE_QUERY_KEY, "models"],
		queryFn: fetchReplicateModels,
		staleTime: 1000 * 60 * 5, // 5 minutes
	});
}

export function useReplicatePredictions() {
	return useQuery({
		queryKey: [REPLICATE_QUERY_KEY, "predictions"],
		queryFn: fetchReplicatePredictions,
		refetchInterval: (query) => {
			const data = query.state.data as ReplicatePrediction[] | undefined;
			if (!data) return false;

			const hasProcessing = data.some((pred) => pred.status === "processing");
			// Backend now polls proactively at 5s intervals, so we can poll less frequently
			return hasProcessing ? 10000 : false; // Reduced from 5s to 10s
		},
	});
}

export function useReplicatePrediction(predictionId: string | null) {
	return useQuery({
		queryKey: [REPLICATE_QUERY_KEY, "prediction", predictionId],
		queryFn: () => fetchReplicatePrediction(predictionId!),
		enabled: !!predictionId,
		refetchInterval: (query) => {
			const data = query.state.data as ReplicatePrediction | undefined;
			if (!data) return false;

			// Backend polls at 5s, we poll at 10s to reduce load
			return data.status === "processing" ? 10000 : false;
		},
	});
}

export function useExecuteReplicateModel() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (request: ExecuteReplicateRequest) =>
			executeReplicateModel(request),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: [REPLICATE_QUERY_KEY, "predictions"],
			});
		},
	});
}
