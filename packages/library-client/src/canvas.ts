import type {
  CanvasGenerateRequest,
  CanvasGenerateResponse,
  CanvasGeneration,
  CanvasMode,
  CanvasModel,
} from "@ngriffin_uk/polychat-schemas/experiences";
import { readStringField } from "@ngriffin_uk/polychat-utility-core";

import { apiService } from "./api-service.js";
import { fetchApi } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";
import { listJobsOfKind, startJobs } from "./jobs.js";

export async function fetchCanvasModels(mode: CanvasMode): Promise<CanvasModel[]> {
  let headers = {};

  try {
    headers = await apiService.getHeaders();
  } catch (error) {
    console.error("Error getting headers for canvas models:", error);
  }

  const response = await fetchApi(`/apps/canvas/models?mode=${mode}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Canvas models: ${response.statusText}`);
  }

  const data = await returnFetchedData<{ models: CanvasModel[] }>(response);

  return data.models || [];
}

export async function generateCanvasOutputs(
  request: CanvasGenerateRequest,
): Promise<CanvasGenerateResponse> {
  const { projectId, ...input } = request;
  const started = await startJobs({
    kind: "canvas_generation",
    project_id: projectId,
    input,
  });

  return {
    generations: [
      ...started.data.flatMap((job) =>
        job.kind === "canvas_generation"
          ? [
              {
                modelId: job.result.modelId,
                modelName: job.result.modelName ?? job.result.modelId,
                provider: job.result.provider,
                status: job.result.status,
                generationId: job.id,
                error: job.result.error,
              },
            ]
          : [],
      ),
      ...started.rejected.map((rejection) => ({
        modelId: readStringField(rejection.detail, "modelId") ?? "",
        modelName: readStringField(rejection.detail, "modelName") ?? "",
        provider: readStringField(rejection.detail, "provider"),
        status: "failed" as const,
        error: rejection.error,
      })),
    ],
  };
}

export async function fetchCanvasGenerations(
  mode?: CanvasMode,
  projectId?: string,
): Promise<CanvasGeneration[]> {
  const listed = await listJobsOfKind("canvas_generation", { project_id: projectId });

  return listed.map((job) => job.result).filter((generation) => !mode || generation.mode === mode);
}
