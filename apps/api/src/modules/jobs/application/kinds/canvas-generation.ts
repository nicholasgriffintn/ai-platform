import type { JobStatus } from "@ngriffin_uk/polychat-schemas";

import { generateCanvasBatch } from "~/modules/apps/application/canvas/generate";
import { mapCanvasGenerationRecord } from "~/modules/apps/application/canvas/records";
import type { CanvasGenerationStatus } from "~/modules/apps/application/canvas/types";

import type { JobKindDefinition } from "../../domain/job-kind";
import { readScopedOutput } from "../outputs";
import { jobFields } from "../present";

const CANVAS_JOB_STATUS: Record<CanvasGenerationStatus, JobStatus> = {
  queued: "queued",
  processing: "in_progress",
  succeeded: "succeeded",
  completed: "succeeded",
  failed: "failed",
};

export const canvasGenerationJobs: JobKindDefinition<"canvas_generation"> = {
  kind: "canvas_generation",
  outputCapability: "canvas",
  projectCapability: "featured-image-studio",
  async start(scope, input) {
    const results = await generateCanvasBatch({
      context: scope.context,
      params: { ...input, projectId: scope.projectId },
      user: scope.user,
    });
    const started = await Promise.all(
      results.map(async (result) => ({
        result,
        record: result.generationId ? await readScopedOutput(scope, result.generationId) : null,
      })),
    );

    return {
      jobs: started.flatMap(({ record }) => {
        const job = record ? canvasGenerationJobs.present(record) : null;

        return job ? [job] : [];
      }),
      rejected: started
        .filter(({ record }) => !record)
        .map(({ result }) => ({
          error: result.error ?? "The generation could not be queued",
          detail: {
            modelId: result.modelId,
            modelName: result.modelName,
            provider: result.provider,
          },
        })),
    };
  },
  present(record) {
    if (record.capability_id !== "canvas") {
      return null;
    }

    const generation = mapCanvasGenerationRecord(record);

    return {
      ...jobFields(record),
      kind: "canvas_generation",
      status: CANVAS_JOB_STATUS[generation.status],
      result: generation,
      error: generation.error ?? null,
    };
  },
};
