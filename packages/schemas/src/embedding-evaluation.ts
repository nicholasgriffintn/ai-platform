import { z } from "zod/v4";

const evaluationId = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/);
const evaluationText = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0);
const evaluationVector = z.array(z.number().finite()).min(1).max(4096);

export const embeddingEvaluationDatasetSchema = z
  .object({
    id: evaluationId,
    passages: z.record(evaluationId, evaluationText),
    queries: z.record(
      evaluationId,
      z
        .object({
          category: evaluationId,
          content: evaluationText,
          relevance: z.record(evaluationId, z.number().int().min(1).max(3)),
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((dataset, ctx) => {
    if (!Object.keys(dataset.passages).length || !Object.keys(dataset.queries).length) {
      ctx.addIssue({ code: "custom", message: "Evaluation needs passages and queries" });
    }

    for (const [id, query] of Object.entries(dataset.queries)) {
      if (!Object.keys(query.relevance).length) {
        ctx.addIssue({
          code: "custom",
          path: ["queries", id],
          message: "Query needs relevance labels",
        });
      }

      for (const passageId of Object.keys(query.relevance)) {
        if (!Object.hasOwn(dataset.passages, passageId)) {
          ctx.addIssue({
            code: "custom",
            path: ["queries", id],
            message: "Unknown relevant passage",
          });
        }
      }
    }
  });

export const embeddingEvaluationCaptureSchema = z
  .object({
    datasetSha256: z.string().regex(/^[a-f0-9]{64}$/),
    provider: evaluationId,
    model: evaluationText,
    dimensions: z.number().int().min(1).max(4096),
    distanceMetric: z.literal("cosine"),
    taskMode: z.enum(["symmetric", "asymmetric"]),
    vectorSpaceVersion: evaluationId,
    capturedAt: z.iso.datetime(),
    transport: z.enum(["direct-api", "workers-binding"]),
    cache: z.enum(["cold", "warm", "unknown"]),
    costUsd: z.number().finite().nonnegative().nullable(),
    documentDurationMs: z.number().finite().nonnegative(),
    passages: z.record(evaluationId, evaluationVector),
    queries: z.record(
      evaluationId,
      z
        .array(
          z
            .object({ values: evaluationVector, durationMs: z.number().finite().nonnegative() })
            .strict(),
        )
        .min(1),
    ),
  })
  .strict()
  .superRefine((capture, ctx) => {
    const vectors = [
      ...Object.values(capture.passages),
      ...Object.values(capture.queries)
        .flat()
        .map((sample) => sample.values),
    ];

    if (!vectors.length) {
      ctx.addIssue({ code: "custom", message: "Capture needs vectors" });
    }

    for (const vector of vectors) {
      if (vector.length !== capture.dimensions || !vector.some((value) => value !== 0)) {
        ctx.addIssue({
          code: "custom",
          message: "Vector does not match capture dimensions or has zero norm",
        });
        break;
      }
    }
  });

export type EmbeddingEvaluationDataset = z.infer<typeof embeddingEvaluationDatasetSchema>;
export type EmbeddingEvaluationCapture = z.infer<typeof embeddingEvaluationCaptureSchema>;
