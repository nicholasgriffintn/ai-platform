import z from "zod/v4";

import { skillIdSchema } from "./skills.js";

export const PROPOSE_CORRECTION_TOOL_NAME = "propose_correction";

export const CORRECTION_PLACEMENTS = ["skill", "memory", "policy"] as const;

export const correctionPlacementSchema = z.enum(CORRECTION_PLACEMENTS);

export type CorrectionPlacement = z.infer<typeof correctionPlacementSchema>;

export const correctionStatusSchema = z.enum(["active", "dismissed"]);

export const proposeCorrectionInputSchema = z.object({
  pattern: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .describe(
      "The rule the correction teaches, as one sentence that applies beyond this message, such as 'Use British spelling in client emails'. Not the fix to this one answer.",
    ),
  quote: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .describe(
      "The person's own words that made the correction, copied exactly from their message.",
    ),
  placement: z
    .discriminatedUnion("type", [
      z.object({
        type: z.literal("memory"),
      }),
      z.object({
        type: z.literal("skill"),
        name: skillIdSchema.describe("The skill that told you to do the wrong thing."),
        instructions: z
          .string()
          .trim()
          .min(1)
          .max(64 * 1024)
          .describe("The full corrected playbook, not a diff or a note about what changed."),
      }),
    ])
    .describe(
      "Where the rule should live. Use skill when a skill's playbook caused the mistake; otherwise memory.",
    ),
});

export type ProposeCorrectionInput = z.infer<typeof proposeCorrectionInputSchema>;

export const correctionSchema = z.object({
  id: z.string().min(1),
  pattern: z.string(),
  quote: z.string(),
  placement: correctionPlacementSchema,
  placementRef: z.string().nullable(),
  recurrences: z.number().int().nonnegative(),
  status: correctionStatusSchema,
  createdAt: z.string(),
  lastRecurredAt: z.string().nullable(),
});

export type Correction = z.infer<typeof correctionSchema>;

export const correctionListResponseSchema = z.object({
  corrections: z.array(correctionSchema),
});

export type CorrectionListResponse = z.infer<typeof correctionListResponseSchema>;
