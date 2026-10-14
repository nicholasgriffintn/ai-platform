import type { Job, JobKind } from "@ngriffin_uk/polychat-schemas";

import type { OutputRecord } from "~/modules/outputs/infrastructure/OutputRepository";
import type { SyncPublisher } from "~/modules/sync/application/publish";

import type { JobKindDefinition, JobKindView } from "../domain/job-kind";
import { articleAnalysisJobs, articleReportJobs, articleSummaryJobs } from "./kinds/articles";
import { canvasGenerationJobs } from "./kinds/canvas-generation";
import { ocrBatchJobs } from "./kinds/ocr-batch";
import {
  recordingImageJobs,
  recordingSummaryJobs,
  recordingTranscriptionJobs,
} from "./kinds/recordings";
import { replicatePredictionJobs } from "./kinds/replicate-prediction";
import { researchJobs } from "./kinds/research";
import { siteEvaluationJobs } from "./kinds/site-evaluation";
import { publishJobChanged } from "./publish";

type JobKindRegistry = { [TKind in JobKind]: JobKindDefinition<TKind> };

export const JOB_KIND_DEFINITIONS: JobKindRegistry = {
  canvas_generation: canvasGenerationJobs,
  replicate_prediction: replicatePredictionJobs,
  ocr_batch: ocrBatchJobs,
  research: researchJobs,
  site_evaluation: siteEvaluationJobs,
  recording_transcription: recordingTranscriptionJobs,
  recording_summary: recordingSummaryJobs,
  recording_image: recordingImageJobs,
  article_analysis: articleAnalysisJobs,
  article_summary: articleSummaryJobs,
  article_report: articleReportJobs,
};

export const JOB_KIND_LIST: JobKindView[] = Object.values(JOB_KIND_DEFINITIONS);

export function presentOutputJob(record: OutputRecord): Job | null {
  for (const definition of JOB_KIND_LIST) {
    const job = definition.present(record);

    if (job) {
      return job;
    }
  }

  return null;
}

export function publishOutputJobChanged(
  publisher: SyncPublisher,
  userId: number,
  record: OutputRecord,
): void {
  const job = presentOutputJob(record);

  if (job) {
    publishJobChanged(publisher, userId, job);
  }
}
