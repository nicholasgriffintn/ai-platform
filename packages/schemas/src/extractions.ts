import z from "zod/v4";

import { decisionMediaDecodedBytes, decisionMediaSchema } from "./decisions.js";

export const EXTRACTION_FIELD_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/;
export const EXTRACTION_MAX_FIELDS = 128;
export const EXTRACTION_FORECAST_MAX_HORIZON = 64;
export const EXTRACTION_IMAGES_MAX_TOTAL_BYTES = 8 * 1024 * 1024;

export const EXTRACTION_FIELD_TYPES = [
  "text",
  "number",
  "date",
  "time",
  "datetime",
  "duration",
  "list",
  "estimate",
  "forecast",
] as const;
export type ExtractionFieldType = (typeof EXTRACTION_FIELD_TYPES)[number];

export const EXTRACTION_DURATION_UNITS = [
  "seconds",
  "minutes",
  "hours",
  "days",
  "weeks",
  "months",
  "years",
] as const;

export const EXTRACTION_FORECAST_INTERVALS = [
  "step",
  "minute",
  "hour",
  "day",
  "week",
  "month",
  "quarter",
  "year",
] as const;

const instructionsSchema = z.string().trim().min(1).max(2_000).optional();
const nullThresholdSchema = z.number().gt(0).max(1).optional();
const decimalsSchema = z.number().int().min(0).max(6).optional();
const unitSchema = z.string().trim().min(1).max(32).optional();
const scaleSchema = z.enum(["linear", "log"]).optional();

export const extractionTextFieldSchema = z
  .object({
    type: z.literal("text"),
    instructions: instructionsSchema,
    null_threshold: nullThresholdSchema,
  })
  .strict();

export const extractionNumberFieldSchema = z
  .object({
    type: z.literal("number"),
    instructions: instructionsSchema,
    unit: unitSchema,
    integer: z.boolean().optional(),
    decimals: decimalsSchema,
    null_threshold: nullThresholdSchema,
  })
  .strict();

export const extractionTemporalFieldSchema = z
  .object({
    type: z.enum(["date", "time", "datetime"]),
    instructions: instructionsSchema,
    null_threshold: nullThresholdSchema,
  })
  .strict();

export const extractionDurationFieldSchema = z
  .object({
    type: z.literal("duration"),
    instructions: instructionsSchema,
    unit: z.enum(EXTRACTION_DURATION_UNITS).optional(),
    integer: z.boolean().optional(),
    decimals: decimalsSchema,
    null_threshold: nullThresholdSchema,
  })
  .strict();

export const extractionListFieldSchema = z
  .object({
    type: z.literal("list"),
    items: z.enum(["text", "number", "date"]),
    instructions: instructionsSchema,
    decimals: decimalsSchema,
  })
  .strict();

const estimateBoundSchema = z.union([z.number(), z.iso.date()]);

export const extractionEstimateFieldSchema = z
  .object({
    type: z.literal("estimate"),
    min: estimateBoundSchema,
    max: estimateBoundSchema,
    step: z.union([z.number().positive(), z.enum(["month", "year"])]).optional(),
    scale: scaleSchema,
    unit: unitSchema,
    instructions: instructionsSchema,
  })
  .strict()
  .refine(
    (field) =>
      typeof field.min === "number" && typeof field.max === "number"
        ? field.min < field.max
        : typeof field.min === "string" && typeof field.max === "string" && field.min < field.max,
    {
      message: "Estimate bounds must both be numbers or both be ISO dates, with min below max",
      path: ["max"],
    },
  );

export const extractionForecastFieldSchema = z
  .object({
    type: z.literal("forecast"),
    min: z.number(),
    max: z.number(),
    horizon: z.number().int().min(1).max(EXTRACTION_FORECAST_MAX_HORIZON).optional(),
    interval: z.enum(EXTRACTION_FORECAST_INTERVALS).optional(),
    scale: scaleSchema,
    unit: unitSchema,
    instructions: instructionsSchema,
  })
  .strict()
  .refine((field) => field.min < field.max, {
    message: "Forecast min must be below max",
    path: ["max"],
  });

export const extractionFieldSchema = z.union([
  extractionTextFieldSchema,
  extractionNumberFieldSchema,
  extractionTemporalFieldSchema,
  extractionDurationFieldSchema,
  extractionListFieldSchema,
  extractionEstimateFieldSchema,
  extractionForecastFieldSchema,
]);
export type ExtractionField = z.infer<typeof extractionFieldSchema>;

export const extractionFieldsSchema = z
  .record(z.string().regex(EXTRACTION_FIELD_NAME_PATTERN), extractionFieldSchema)
  .refine(
    (fields) =>
      Object.keys(fields).length > 0 && Object.keys(fields).length <= EXTRACTION_MAX_FIELDS,
    { message: `Ask for between 1 and ${EXTRACTION_MAX_FIELDS} fields` },
  );
export type ExtractionFields = z.infer<typeof extractionFieldsSchema>;

export const extractionOptionsSchema = z
  .object({
    include_quantiles: z.boolean().optional(),
    return_state_text: z.boolean().optional(),
  })
  .strict();
export type ExtractionOptions = z.infer<typeof extractionOptionsSchema>;

export const extractionRequestSchema = z
  .object({
    state: z.string().max(200_000).optional(),
    fields: extractionFieldsSchema,
    images: decisionMediaSchema.shape.images,
    reference_date: z.iso.date().optional(),
    options: extractionOptionsSchema.optional(),
    model: z.string().min(1).optional(),
    provider: z.string().min(1).optional(),
  })
  .strict()
  .refine(
    (request) => (request.state?.trim().length ?? 0) > 0 || (request.images?.length ?? 0) > 0,
    {
      message: "Send some state text or at least one image",
      path: ["state"],
    },
  )
  .refine(
    (request) =>
      (request.images ?? []).reduce(
        (total, image) => total + decisionMediaDecodedBytes(image),
        0,
      ) <= EXTRACTION_IMAGES_MAX_TOTAL_BYTES,
    { message: "Images together must be at most 8 MiB", path: ["images"] },
  );
export type ExtractionRequest = z.infer<typeof extractionRequestSchema>;

const probabilitySchema = z.number();
const spanSchema = z.tuple([z.number().int(), z.number().int()]);
const estimatePointSchema = z.union([z.number(), z.string()]);

function scalarAnswerSchema<const TType extends string, TValue extends z.ZodType>(
  type: TType,
  value: TValue,
) {
  return z.object({
    type: z.literal(type),
    value: value.nullable(),
    guess: value.nullish(),
    p_null: probabilitySchema.nullish(),
    confidence: probabilitySchema.nullish(),
  });
}

export const extractionTextAnswerSchema = scalarAnswerSchema("text", z.string()).extend({
  span: spanSchema.nullish(),
});
export const extractionNumberAnswerSchema = scalarAnswerSchema("number", z.number());
export const extractionDateAnswerSchema = scalarAnswerSchema("date", z.string());
export const extractionTimeAnswerSchema = scalarAnswerSchema("time", z.string());
export const extractionDatetimeAnswerSchema = scalarAnswerSchema("datetime", z.string());
export const extractionDurationAnswerSchema = scalarAnswerSchema("duration", z.number()).extend({
  unit: z.string().nullish(),
});

export const extractionListAnswerSchema = z.object({
  type: z.literal("list"),
  value: z.array(z.union([z.string(), z.number()])).nullable(),
  spans: z.array(spanSchema.nullable()).nullish(),
  confidence: probabilitySchema.nullish(),
});

export const extractionEstimateAnswerSchema = z.object({
  type: z.literal("estimate"),
  value: estimatePointSchema.nullable(),
  mean: estimatePointSchema.nullish(),
  median: estimatePointSchema.nullish(),
  p10: estimatePointSchema.nullish(),
  p90: estimatePointSchema.nullish(),
  p_below: probabilitySchema.nullish(),
  p_above: probabilitySchema.nullish(),
  quantiles: z.array(estimatePointSchema).nullish(),
});

const forecastSeriesSchema = z.array(z.number().nullable());

export const extractionForecastAnswerSchema = z.object({
  type: z.literal("forecast"),
  value: forecastSeriesSchema.nullable(),
  median: forecastSeriesSchema.nullish(),
  p10: forecastSeriesSchema.nullish(),
  p90: forecastSeriesSchema.nullish(),
  steps: z.array(extractionEstimateAnswerSchema.omit({ type: true }).partial()).nullish(),
});

export const extractionAnswerSchema = z.discriminatedUnion("type", [
  extractionTextAnswerSchema,
  extractionNumberAnswerSchema,
  extractionDateAnswerSchema,
  extractionTimeAnswerSchema,
  extractionDatetimeAnswerSchema,
  extractionDurationAnswerSchema,
  extractionListAnswerSchema,
  extractionEstimateAnswerSchema,
  extractionForecastAnswerSchema,
]);
export type ExtractionAnswer = z.infer<typeof extractionAnswerSchema>;

export type ExtractionAnswerFor<TField extends ExtractionField> = Extract<
  ExtractionAnswer,
  { type: TField["type"] }
>;

export type ExtractionAnswers<TFields extends ExtractionFields> = {
  [TName in keyof TFields]: ExtractionAnswerFor<TFields[TName]>;
};

export const extractionUsageSchema = z.object({
  input_tokens: z.number().int().min(0),
  output_tokens: z.number().int().min(0),
});
export type ExtractionUsage = z.infer<typeof extractionUsageSchema>;

export const extractionResponseSchema = z.object({
  provider: z.string(),
  model: z.string(),
  answers: z.record(z.string(), extractionAnswerSchema),
  truncated: z.boolean(),
  state_text: z.string().optional(),
  usage: extractionUsageSchema,
});
export type ExtractionResponse = z.infer<typeof extractionResponseSchema>;
