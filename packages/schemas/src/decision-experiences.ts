import z from "zod/v4";

import { decisionUsageSchema } from "./decisions.js";

const probabilitySchema = z.number().min(0).max(1);

export const VERBATIM_CONTEXT_MAX_LENGTH = 600;
export const VERBATIM_SEGMENT_MAX_BYTES = 2 * 1024 * 1024;

export const verbatimSegmentFormSchema = z.object({
  audio: z.custom<File>(
    (value) => typeof File !== "undefined" && value instanceof File,
    "An audio file is required",
  ),
  context: z.string().max(VERBATIM_CONTEXT_MAX_LENGTH).optional(),
});

const verbatimTimingsSchema = z.object({
  transcribeMs: z.number().min(0),
  decideMs: z.number().min(0),
  repairMs: z.number().min(0),
});

export const verbatimWordSchema = z.object({
  text: z.string(),
  probability: probabilitySchema.nullable(),
  removed: z.boolean(),
});
export type VerbatimWord = z.infer<typeof verbatimWordSchema>;

const verbatimReadingSchema = z.object({
  label: z.string(),
  score: probabilitySchema,
  scale: z.array(z.string()),
});

export const verbatimRepairSchema = z.object({
  applied: z.boolean(),
  candidate: z.string(),
  probability: probabilitySchema,
  keptProbability: probabilitySchema,
});
export type VerbatimRepair = z.infer<typeof verbatimRepairSchema>;

export const verbatimSegmentSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("silence"),
    timings: verbatimTimingsSchema,
  }),
  z.object({
    status: z.literal("no_speech"),
    rawText: z.string(),
    speech: probabilitySchema,
    timings: verbatimTimingsSchema,
  }),
  z.object({
    status: z.literal("transcribed"),
    text: z.string(),
    rawText: z.string(),
    words: z.array(verbatimWordSchema),
    checks: z.object({
      speech: probabilitySchema,
      verbatim: probabilitySchema,
      fluent: probabilitySchema,
      coherent: probabilitySchema,
    }),
    delivery: z.object({
      pace: verbatimReadingSchema,
      noise: verbatimReadingSchema,
      tone: verbatimReadingSchema,
    }),
    repair: verbatimRepairSchema.nullable(),
    model: z.string(),
    usage: decisionUsageSchema,
    timings: verbatimTimingsSchema,
  }),
]);
export type VerbatimSegment = z.infer<typeof verbatimSegmentSchema>;

export const verbatimStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("draft"), text: z.string() }),
  z.object({ type: z.literal("segment"), segment: verbatimSegmentSchema }),
  z.object({ type: z.literal("error"), error: z.string() }),
]);
export type VerbatimStreamEvent = z.infer<typeof verbatimStreamEventSchema>;
