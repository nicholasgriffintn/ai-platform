import z from "zod/v4";

export const DISCOVER_WIND_DOWN_KIND = "discover.wind_down";
export const WIND_DOWN_TOOL_NAME = "prepare_wind_down";
export const DISCOVER_WIND_DOWN_KINDS = [
  "breathing",
  "body_scan",
  "unwind",
  "story",
  "read_back",
  "park",
  "sound",
] as const;
export const DISCOVER_WIND_DOWN_MINUTES = [5, 10, 20, 30] as const;
export const DISCOVER_WIND_DOWN_BEDS = ["night", "rain", "sea", "embers", "aurora"] as const;
export const DISCOVER_WIND_DOWN_AFTER_VOICE_MINUTES = [0, 15, 30, 60] as const;
export const DISCOVER_WIND_DOWN_STORY_PARTS = 5;
export const DISCOVER_WIND_DOWN_MAX_STEPS = 60;
export const DISCOVER_WIND_DOWN_NOTES_MAX_LENGTH = 4_000;

export const discoverWindDownKindSchema = z.enum(DISCOVER_WIND_DOWN_KINDS);

export const discoverWindDownBedSchema = z.enum(DISCOVER_WIND_DOWN_BEDS);

export const discoverWindDownMinutesSchema = z.union([
  z.literal(5),
  z.literal(10),
  z.literal(20),
  z.literal(30),
]);

const draftStepSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(1)
      .describe("What the guide says, calm and plain, written to be spoken."),
    pauseSeconds: z
      .number()
      .int()
      .min(0)
      .max(60)
      .describe("Quiet time after this step before the next one."),
  })
  .strict();

export const discoverWindDownDraftSchema = z
  .object({
    title: z.string().trim().min(1),
    summary: z
      .string()
      .trim()
      .min(1)
      .describe("One sentence on what this session covered, so later ones can avoid repeating it."),
    steps: z.array(draftStepSchema).min(4).max(DISCOVER_WIND_DOWN_MAX_STEPS),
  })
  .strict();

export const discoverWindDownParkDraftSchema = discoverWindDownDraftSchema
  .extend({
    parked: z
      .array(z.string().trim().min(1).max(200))
      .max(10)
      .describe("Each thing they set aside for tomorrow, as a short line in their own words."),
  })
  .strict();

export const discoverWindDownContentSchema = z
  .object({
    format: z.literal("wind_down"),
    kind: discoverWindDownKindSchema,
    minutes: discoverWindDownMinutesSchema,
    title: z.string().min(1),
    steps: z
      .array(
        z
          .object({
            text: z.string().min(1),
            pauseSeconds: z.number().int().min(0).max(60),
            audio: z.boolean(),
          })
          .strict(),
      )
      .max(DISCOVER_WIND_DOWN_MAX_STEPS),
    status: z.enum(["pending", "speaking", "ready", "failed"]),
    bed: discoverWindDownBedSchema.default("night"),
    ambient: z.boolean().default(false),
    summary: z.string().min(1).optional(),
    topic: z.string().min(1).optional(),
    part: z.number().int().min(1).optional(),
    parked: z.array(z.string().min(1)).optional(),
  })
  .strict();

export const discoverWindDownSchema = discoverWindDownContentSchema.extend({
  id: z.string().min(1),
});

export const createDiscoverWindDownSchema = z
  .object({
    kind: discoverWindDownKindSchema,
    minutes: discoverWindDownMinutesSchema,
    bed: discoverWindDownBedSchema
      .optional()
      .describe("The sound and scene underneath. Leave it out to let Poly choose."),
    aboutToday: z
      .boolean()
      .optional()
      .describe("False keeps their day out of the session, for a shared room or screen."),
    topic: z
      .string()
      .trim()
      .min(1)
      .max(60)
      .optional()
      .describe("For a story, what it wanders through."),
    premise: z
      .string()
      .trim()
      .min(1)
      .max(400)
      .optional()
      .describe("For a story, where tonight's part goes."),
    notes: z
      .string()
      .trim()
      .min(1)
      .max(DISCOVER_WIND_DOWN_NOTES_MAX_LENGTH)
      .optional()
      .describe("For park, what is on their mind, in their words."),
  })
  .strict();

export const discoverWindDownTonightSchema = z.object({
  kind: discoverWindDownKindSchema,
  minutes: discoverWindDownMinutesSchema,
  bed: discoverWindDownBedSchema,
  topic: z.string().nullable(),
  reason: z.string().min(1),
  readBack: z.boolean(),
});

export const discoverWindDownParamsSchema = z.object({ wind_down_id: z.string().min(1) });

export const discoverWindDownBedParamsSchema = z.object({ bed: discoverWindDownBedSchema });

export const discoverWindDownStepParamsSchema = discoverWindDownParamsSchema.extend({
  step: z.coerce
    .number()
    .int()
    .min(0)
    .max(DISCOVER_WIND_DOWN_MAX_STEPS - 1),
});

export type DiscoverWindDownKind = z.infer<typeof discoverWindDownKindSchema>;
export type DiscoverWindDownBed = z.infer<typeof discoverWindDownBedSchema>;
export type DiscoverWindDownMinutes = z.infer<typeof discoverWindDownMinutesSchema>;
export type DiscoverWindDownDraft = z.infer<typeof discoverWindDownDraftSchema>;
export type DiscoverWindDownContent = z.infer<typeof discoverWindDownContentSchema>;
export type DiscoverWindDown = z.infer<typeof discoverWindDownSchema>;
export type CreateDiscoverWindDown = z.infer<typeof createDiscoverWindDownSchema>;
export type DiscoverWindDownTonight = z.infer<typeof discoverWindDownTonightSchema>;
