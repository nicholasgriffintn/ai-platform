import z from "zod/v4";

export const DISCOVER_WIND_DOWN_KIND = "discover.wind_down";
export const WIND_DOWN_TOOL_NAME = "prepare_wind_down";
export const DISCOVER_WIND_DOWN_KINDS = ["breathing", "body_scan", "unwind"] as const;
export const DISCOVER_WIND_DOWN_MINUTES = [5, 10, 20] as const;

export const discoverWindDownKindSchema = z.enum(DISCOVER_WIND_DOWN_KINDS);

export const discoverWindDownMinutesSchema = z.union([z.literal(5), z.literal(10), z.literal(20)]);

export const discoverWindDownDraftSchema = z
  .object({
    title: z.string().trim().min(1),
    steps: z
      .array(
        z
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
          .strict(),
      )
      .min(4)
      .max(40),
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
      .max(40),
    status: z.enum(["pending", "speaking", "ready", "failed"]),
    ambient: z.boolean().default(false),
  })
  .strict();

export const discoverWindDownSchema = discoverWindDownContentSchema.extend({
  id: z.string().min(1),
});

export const createDiscoverWindDownSchema = z
  .object({ kind: discoverWindDownKindSchema, minutes: discoverWindDownMinutesSchema })
  .strict();

export const discoverWindDownParamsSchema = z.object({ wind_down_id: z.string().min(1) });

export const discoverWindDownStepParamsSchema = discoverWindDownParamsSchema.extend({
  step: z.coerce.number().int().min(0).max(39),
});

export type DiscoverWindDownKind = z.infer<typeof discoverWindDownKindSchema>;
export type DiscoverWindDownDraft = z.infer<typeof discoverWindDownDraftSchema>;
export type DiscoverWindDownContent = z.infer<typeof discoverWindDownContentSchema>;
export type DiscoverWindDown = z.infer<typeof discoverWindDownSchema>;
export type CreateDiscoverWindDown = z.infer<typeof createDiscoverWindDownSchema>;
