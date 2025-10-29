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
      return hasProcessing ? 5000 : false; // Poll every 5 seconds if any are processing
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

      // Poll every 5 seconds if processing
      return data.status === "processing" ? 5000 : false;
    },
  });
}

export function useExecuteReplicateModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: ExecuteReplicateRequest) =>
      executeReplicateModel(request),
    onSuccess: () => {
      // Invalidate predictions list to refetch
      queryClient.invalidateQueries({
        queryKey: [REPLICATE_QUERY_KEY, "predictions"],
      });
    },
  });
}
