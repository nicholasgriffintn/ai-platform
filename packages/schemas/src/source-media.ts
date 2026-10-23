import z from "zod/v4";

import { generateCanvasSchema } from "./experiences/canvas.js";
import { executeReplicateRequestSchema } from "./replicate.js";

export const SOURCE_MEDIA_TYPES = ["image", "audio", "video"] as const;

export type SourceMediaType = (typeof SOURCE_MEDIA_TYPES)[number];

export function getSourceMediaType(mimeType: string | null | undefined): SourceMediaType | null {
  const type = mimeType?.split("/")[0]?.toLowerCase();

  return SOURCE_MEDIA_TYPES.find((candidate) => candidate === type) ?? null;
}

export function isTranscribableMediaType(type: SourceMediaType | null): boolean {
  return type === "audio" || type === "video";
}

export const sourceTranscriptSegmentSchema = z.object({
  speaker: z.string().optional(),
  text: z.string(),
  start: z.number().optional(),
  end: z.number().optional(),
});

export const sourceTranscriptSchema = z.object({
  status: z.enum(["processing", "ready", "failed"]),
  speakers: z.record(z.string(), z.string()).default({}),
  segments: z.array(sourceTranscriptSegmentSchema).default([]),
  error: z.string().optional(),
});

export const sourceActionItemSchema = z.object({
  task: z
    .string()
    .min(1)
    .describe("One concrete thing someone said they or another person will do."),
  owner: z.string().nullable().describe("Who will do it, only when the transcript names them."),
  due: z.string().nullable().describe("When it is due, only when the transcript states it."),
});

export const sourceNotesSchema = z.object({
  summary: z.string().min(1).describe("What the transcript covers, in a few sentences."),
  decisions: z.array(z.string().min(1)).describe("Decisions the speakers agreed on."),
  actionItems: z.array(sourceActionItemSchema).describe("Commitments made by the speakers."),
});

export const sourceCoverSchema = z.object({
  key: z.string().min(1),
  mimeType: z.string().min(1),
});

export const sourceMediaMetadataSchema = z.object({
  transcript: sourceTranscriptSchema.optional(),
  notes: sourceNotesSchema.optional(),
  cover: sourceCoverSchema.optional(),
  durationSeconds: z.number().nonnegative().optional(),
});

export const sourceGenerationTypeSchema = z.enum(["podcast", "studio", "model", "drawing"]);

export const sourceGenerationSchema = z.object({
  type: sourceGenerationTypeSchema,
  modelId: z.string().optional(),
  modelName: z.string().optional(),
  provider: z.string().optional(),
  mode: z.string().optional(),
  prompt: z.string().optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  sourceIds: z.array(z.string()).optional(),
  output: z.unknown().optional(),
  error: z.string().optional(),
});

function readMetadataField<TSchema extends z.ZodType>(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
  schema: TSchema,
): z.infer<TSchema> | null {
  const parsed = schema.safeParse(metadata?.[key]);

  return parsed.success ? parsed.data : null;
}

export function readSourceMedia(
  metadata: Record<string, unknown> | null | undefined,
): SourceMediaMetadata {
  return readMetadataField(metadata, "media", sourceMediaMetadataSchema) ?? {};
}

export function readSourceGeneration(
  metadata: Record<string, unknown> | null | undefined,
): SourceGeneration | null {
  return readMetadataField(metadata, "generation", sourceGenerationSchema);
}

export function formatTranscriptText(transcript: SourceTranscript): string {
  return transcript.segments
    .map((segment) => {
      const speaker = segment.speaker
        ? (transcript.speakers[segment.speaker] ?? segment.speaker)
        : "";

      return speaker ? `${speaker}: ${segment.text.trim()}` : segment.text.trim();
    })
    .filter(Boolean)
    .join("\n");
}

export const summariseSourceSchema = z
  .object({ speakers: z.record(z.string(), z.string().trim().min(1).max(80)).optional() })
  .strict();

export const createSourceCoverSchema = z
  .object({ prompt: z.string().trim().max(1000).optional() })
  .strict();

export const podcastFormatSchema = z.enum(["deep_dive", "brief", "debate", "critique"]);
export const podcastLengthSchema = z.enum(["short", "default", "long"]);

export const PODCAST_FORMATS: Record<PodcastFormat, { label: string; description: string }> = {
  deep_dive: {
    label: "Deep dive",
    description: "Two hosts unpack the material, connect the ideas and explain why it matters.",
  },
  brief: {
    label: "Brief",
    description: "A quick rundown of the main points for a short listen.",
  },
  debate: {
    label: "Debate",
    description: "The hosts take opposing views and argue the material out.",
  },
  critique: {
    label: "Critique",
    description: "An expert review that tests the material and suggests improvements.",
  },
};

export const generatePodcastSchema = z
  .object({
    projectId: z.string().min(1).nullable().optional(),
    sourceIds: z.array(z.string().min(1)).max(20).default([]),
    material: z.string().trim().min(1).max(100_000).optional(),
    title: z.string().trim().min(1).max(200).optional(),
    focus: z.string().trim().max(2000).optional(),
    format: podcastFormatSchema.default("deep_dive"),
    length: podcastLengthSchema.default("default"),
    language: z.string().trim().min(2).max(10).default("en"),
    showId: z.string().min(1).optional(),
  })
  .strict()
  .refine((value) => value.sourceIds.length > 0 || Boolean(value.material), {
    error: "Choose at least one source or provide material for the episode",
  });

export const podcastScriptTurnSchema = z.object({
  speaker: z.enum(["host", "guest"]).describe("Who speaks this line."),
  text: z.string().min(1).describe("What they say, written to be spoken aloud."),
});

export const podcastScriptSchema = z.object({
  title: z.string().min(1).describe("A short episode title."),
  description: z.string().min(1).describe("Show notes in two or three sentences."),
  turns: z.array(podcastScriptTurnSchema).min(2).describe("The conversation in order."),
});

export const generateSourceMediaSchema = z.discriminatedUnion("type", [
  generateCanvasSchema.omit({ projectId: true }).extend({
    type: z.literal("studio"),
    projectId: z.string().min(1).nullable().optional(),
  }),
  executeReplicateRequestSchema.extend({
    type: z.literal("model"),
    projectId: z.string().min(1).nullable().optional(),
  }),
]);

export const sourceGenerationRejectionSchema = z.object({
  error: z.string(),
  modelId: z.string().optional(),
  modelName: z.string().optional(),
});

export const enablePodcastFeedResponseSchema = z.object({ url: z.url() }).strict();

export type SourceTranscriptSegment = z.infer<typeof sourceTranscriptSegmentSchema>;
export type SourceTranscript = z.infer<typeof sourceTranscriptSchema>;
export type SourceActionItem = z.infer<typeof sourceActionItemSchema>;
export type SourceNotes = z.infer<typeof sourceNotesSchema>;
export type SourceCover = z.infer<typeof sourceCoverSchema>;
export type SourceMediaMetadata = z.infer<typeof sourceMediaMetadataSchema>;
export type SourceGenerationType = z.infer<typeof sourceGenerationTypeSchema>;
export type SourceGeneration = z.infer<typeof sourceGenerationSchema>;
export type SummariseSourceInput = z.infer<typeof summariseSourceSchema>;
export type CreateSourceCoverInput = z.infer<typeof createSourceCoverSchema>;
export type PodcastFormat = z.infer<typeof podcastFormatSchema>;
export type PodcastLength = z.infer<typeof podcastLengthSchema>;
export type GeneratePodcastInput = z.infer<typeof generatePodcastSchema>;
export type GeneratePodcastRequest = z.input<typeof generatePodcastSchema>;
export type PodcastScriptTurn = z.infer<typeof podcastScriptTurnSchema>;
export type PodcastScript = z.infer<typeof podcastScriptSchema>;
export type GenerateSourceMediaInput = z.infer<typeof generateSourceMediaSchema>;
export type GenerateSourceMediaRequest = z.input<typeof generateSourceMediaSchema>;
export type SourceGenerationRejection = z.infer<typeof sourceGenerationRejectionSchema>;
