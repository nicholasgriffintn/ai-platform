import z from "zod/v4";

import {
  articleAnalyzeSchema,
  articleSummariseSchema,
  deepResearchSchema,
  generateArticlesReportSchema,
  recordingGenerateImageSchema,
  recordingSummariseSchema,
  recordingTranscribeSchema,
} from "./apps.js";
import { canvasGenerationSchema, generateCanvasSchema } from "./experiences/canvas.js";
import { ocrBatchStartRequestSchema } from "./ocr-batch.js";
import { listQuerySchema, listSchema } from "./platform/list.js";
import { executeReplicateRequestSchema, replicatePredictionSchema } from "./replicate.js";
import { researchStatusSchema } from "./research.js";
import { siteEvaluationRequestSchema, siteEvaluationResponseSchema } from "./sites.js";

export const JOB_KINDS = [
  "canvas_generation",
  "replicate_prediction",
  "ocr_batch",
  "research",
  "site_evaluation",
  "recording_transcription",
  "recording_summary",
  "recording_image",
  "article_analysis",
  "article_summary",
  "article_report",
] as const;

export const jobKindSchema = z.enum(JOB_KINDS);

export const jobStatusSchema = z.enum([
  "queued",
  "in_progress",
  "succeeded",
  "failed",
  "cancelled",
]);

export const TERMINAL_JOB_STATUSES = new Set<JobStatus>(["succeeded", "failed", "cancelled"]);

const jobFieldsSchema = z.object({
  object: z.literal("job"),
  id: z.string(),
  status: jobStatusSchema,
  project_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  error: z.string().nullable(),
});

export const outputJobResultSchema = z.object({ title: z.string() }).passthrough();

export const jobSchema = z.discriminatedUnion("kind", [
  jobFieldsSchema.extend({
    kind: z.literal("canvas_generation"),
    result: canvasGenerationSchema,
  }),
  jobFieldsSchema.extend({
    kind: z.literal("replicate_prediction"),
    result: replicatePredictionSchema,
  }),
  jobFieldsSchema.extend({ kind: z.literal("ocr_batch"), result: outputJobResultSchema }),
  jobFieldsSchema.extend({
    kind: z.literal("research"),
    result: researchStatusSchema.partial(),
  }),
  jobFieldsSchema.extend({
    kind: z.literal("site_evaluation"),
    result: siteEvaluationResponseSchema.nullable(),
  }),
  jobFieldsSchema.extend({
    kind: z.literal("recording_transcription"),
    result: outputJobResultSchema,
  }),
  jobFieldsSchema.extend({ kind: z.literal("recording_summary"), result: outputJobResultSchema }),
  jobFieldsSchema.extend({ kind: z.literal("recording_image"), result: outputJobResultSchema }),
  jobFieldsSchema.extend({ kind: z.literal("article_analysis"), result: outputJobResultSchema }),
  jobFieldsSchema.extend({ kind: z.literal("article_summary"), result: outputJobResultSchema }),
  jobFieldsSchema.extend({ kind: z.literal("article_report"), result: outputJobResultSchema }),
]);

const jobScopeSchema = z.object({ project_id: z.string().min(1).optional() });

export const createJobRequestSchema = z.discriminatedUnion("kind", [
  jobScopeSchema.extend({ kind: z.literal("canvas_generation"), input: generateCanvasSchema }),
  jobScopeSchema.extend({
    kind: z.literal("replicate_prediction"),
    input: executeReplicateRequestSchema,
  }),
  jobScopeSchema.extend({ kind: z.literal("ocr_batch"), input: ocrBatchStartRequestSchema }),
  jobScopeSchema.extend({ kind: z.literal("research"), input: deepResearchSchema }),
  jobScopeSchema.extend({ kind: z.literal("site_evaluation"), input: siteEvaluationRequestSchema }),
  jobScopeSchema.extend({
    kind: z.literal("recording_transcription"),
    input: recordingTranscribeSchema,
  }),
  jobScopeSchema.extend({ kind: z.literal("recording_summary"), input: recordingSummariseSchema }),
  jobScopeSchema.extend({
    kind: z.literal("recording_image"),
    input: recordingGenerateImageSchema,
  }),
  jobScopeSchema.extend({ kind: z.literal("article_analysis"), input: articleAnalyzeSchema }),
  jobScopeSchema.extend({ kind: z.literal("article_summary"), input: articleSummariseSchema }),
  jobScopeSchema.extend({ kind: z.literal("article_report"), input: generateArticlesReportSchema }),
]);

export const listJobsQuerySchema = listQuerySchema.extend({
  kind: jobKindSchema.optional(),
  project_id: z.string().min(1).optional(),
  external_id: z.string().min(1).optional(),
});

export const jobParamsSchema = z.object({ job_id: z.string().min(1) });

export const readJobQuerySchema = z.object({
  kind: jobKindSchema.optional(),
  project_id: z.string().min(1).optional(),
});

export const jobListSchema = listSchema(jobSchema);

export const startedJobListSchema = jobListSchema.extend({
  rejected: z.array(
    z.object({ error: z.string(), detail: z.record(z.string(), z.unknown()).optional() }),
  ),
});

export type JobKind = z.infer<typeof jobKindSchema>;
export type JobStatus = z.infer<typeof jobStatusSchema>;
export type Job = z.infer<typeof jobSchema>;
export type JobOf<TKind extends JobKind> = Extract<Job, { kind: TKind }>;
export type CreateJobRequest = z.infer<typeof createJobRequestSchema>;
export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;
export type ReadJobQuery = z.infer<typeof readJobQuerySchema>;
export type StartedJobList = z.infer<typeof startedJobListSchema>;
