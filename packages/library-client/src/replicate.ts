import type {
  ReplicateModel,
  ReplicatePrediction,
  ExecuteReplicateRequest,
} from "@ngriffin_uk/polychat-schemas";

import { listJobsOfKind, readJobOfKind, startJobs } from "./jobs.js";
import { resource } from "./resource.js";

export const fetchReplicateModels = (): Promise<ReplicateModel[]> =>
  resource<ReplicateModel>("/experiences/replicate/models").listAll();

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
