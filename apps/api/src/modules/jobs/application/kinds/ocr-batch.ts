import type { JobStatus } from "@ngriffin_uk/polychat-schemas";

import { cancelOcrBatch, startOcrBatch } from "~/modules/tools/application/retrieval/ocr/batch";

import type { JobKindDefinition } from "../../domain/job-kind";
import { requireScopedOutput } from "../outputs";
import { jobFields, readJobContent } from "../present";

function ocrJobStatus(outputStatus: string, batchStatus: unknown): JobStatus {
  if (batchStatus === "cancelled") {
    return "cancelled";
  }

  if (outputStatus === "ready") {
    return "succeeded";
  }

  if (outputStatus === "failed") {
    return "failed";
  }

  return batchStatus === "queued" ? "queued" : "in_progress";
}

export const ocrBatchJobs: JobKindDefinition<"ocr_batch"> = {
  kind: "ocr_batch",
  outputCapability: "ocr",
  async start(scope, input) {
    const { outputId } = await startOcrBatch(scope.context, scope.user, input, {
      projectId: scope.projectId,
    });
    const job = ocrBatchJobs.present(await requireScopedOutput(scope, outputId));

    return { jobs: job ? [job] : [], rejected: [] };
  },
  present(record) {
    if (record.capability_id !== "ocr" || record.kind !== "ocr_batch") {
      return null;
    }

    const content = readJobContent(record);

    return {
      ...jobFields(record),
      kind: "ocr_batch",
      status: ocrJobStatus(record.status, content.batchStatus),
      result: { ...content, title: record.title },
      error: typeof content.error === "string" ? content.error : null,
    };
  },
  async cancel(scope, record) {
    await cancelOcrBatch(scope.context, scope.user, record.id);
  },
};
