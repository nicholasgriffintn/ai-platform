import z from "zod/v4";

import { toolEffectClassSchema } from "./tool-effects.js";

export const TEAMMATE_TRUST_CHECK_TASK_TYPE = "teammate_trust_check";
export const TEAMMATE_TRUST_CHECK_OUTPUT_KIND = "teammate-trust-check";
export const TEAMMATE_TRUST_CHECK_CAPABILITY_ID = "teammate-trust-check";

export const teammateTrustCheckCaseSchema = z.object({
  teammateId: z.string(),
  teammateName: z.string(),
  fixtureId: z.string(),
  passed: z.boolean(),
  attemptedEffects: z.array(z.object({ tool: z.string(), effect: toolEffectClassSchema })),
  conversationId: z.string().nullable(),
  error: z.string().nullable(),
});

export const teammateTrustCheckReportSchema = z.object({
  checkedAt: z.string(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  errored: z.number().int().nonnegative(),
  cases: z.array(teammateTrustCheckCaseSchema),
});

export const teammateTrustCheckTaskSchema = z.object({
  teammateIds: z.array(z.string().min(1)).max(20).optional(),
});

export type TeammateTrustCheckCase = z.infer<typeof teammateTrustCheckCaseSchema>;
export type TeammateTrustCheckReport = z.infer<typeof teammateTrustCheckReportSchema>;
export type TeammateTrustCheckTask = z.infer<typeof teammateTrustCheckTaskSchema>;
