import type {
  ReplicateModel,
  ReplicatePrediction,
  ExecuteReplicateRequest,
  ReplicateModelsResponse,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApi } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";
import { listJobsOfKind, readJobOfKind, startJobs } from "./jobs.js";
import { withProjectScope } from "./project-scope.js";

export const fetchReplicateModels = async (projectId?: string): Promise<ReplicateModel[]> => {
  try {
    let headers = {};

    try {
      headers = await apiService.getHeaders();
    } catch (error) {
      console.error("Error getting headers:", error);
    }

    const response = await fetchApi(withProjectScope("/apps/replicate/models", projectId), {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Replicate models: ${response.statusText}`);
    }

    const data = await returnFetchedData<ReplicateModelsResponse>(response);

    return data.models || [];
  } catch (error) {
    console.error("Error fetching Replicate models:", error);
    throw error;
  }
};

export const executeReplicateModel = async (
  request: ExecuteReplicateRequest,
  projectId?: string,
): Promise<ReplicatePrediction> => {
  const started = await startJobs({
    kind: "replicate_prediction",
    project_id: projectId,
    input: request,
  });
  const [job] = started.data;

  if (job?.kind !== "replicate_prediction") {
    throw new Error(started.rejected[0]?.error ?? "The prediction was not started");
  }

  return job.result;
};

export const fetchReplicatePredictions = async (
  projectId?: string,
): Promise<ReplicatePrediction[]> =>
  (await listJobsOfKind("replicate_prediction", { project_id: projectId })).map(
    (job) => job.result,
  );

export const fetchReplicatePrediction = async (
  predictionId: string,
  projectId?: string,
): Promise<ReplicatePrediction> =>
  (await readJobOfKind("replicate_prediction", predictionId, projectId)).result;
