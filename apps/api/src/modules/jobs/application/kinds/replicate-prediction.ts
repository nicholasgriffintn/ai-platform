import { replicatePredictionStatusSchema } from "@ngriffin_uk/polychat-schemas";
import { isRecord, readStringField } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { executeReplicateModel } from "~/modules/apps/application/replicate/execute";

import type { JobKindDefinition } from "../../domain/job-kind";
import { requireScopedOutput } from "../outputs";
import { jobFields, jobStatusFromProvider, readJobContent } from "../present";

export const replicatePredictionJobs: JobKindDefinition<"replicate_prediction"> = {
  kind: "replicate_prediction",
  outputCapability: "replicate",
  projectCapability: "featured-replicate",
  async start(scope, input) {
    const result = await executeReplicateModel({
      context: scope.context,
      params: input,
      user: scope.user,
      storage: { projectId: scope.projectId },
    });
    const outputId = typeof result.data?.id === "string" ? result.data.id : null;

    if (!outputId) {
      throw new AssistantError("The prediction was not stored", ErrorType.PROVIDER_ERROR);
    }

    const job = replicatePredictionJobs.present(await requireScopedOutput(scope, outputId));

    return { jobs: job ? [job] : [], rejected: [] };
  },
  present(record) {
    if (record.capability_id !== "replicate") {
      return null;
    }

    const data = readJobContent(record);
    const error = readStringField(data, "error") ?? null;

    return {
      ...jobFields(record),
      kind: "replicate_prediction",
      status:
        record.status === "ready"
          ? "succeeded"
          : record.status === "failed"
            ? "failed"
            : jobStatusFromProvider(data.status),
      result: {
        id: record.id,
        prediction_id: record.group_id ?? undefined,
        status: replicatePredictionStatusSchema.catch("processing").parse(data.status),
        modelId: readStringField(data, "modelId") ?? "",
        modelName: readStringField(data, "modelName"),
        createdAt: readStringField(data, "createdAt") ?? record.created_at,
        input: isRecord(data.input) ? data.input : {},
        output: data.output,
        error: error ?? undefined,
        predictionData: isRecord(data.predictionData) ? data.predictionData : undefined,
      },
      error,
    };
  },
};
