import z from "zod/v4";

import { listSchema } from "./platform/list.js";

export const runVerificationStatusSchema = z.enum(["verified", "unverified", "failed"]);

export type RunVerificationStatus = z.infer<typeof runVerificationStatusSchema>;

export const runVerificationFindingSchema = z.object({
  check: z.enum(["evidence", "council", "file"]),
  status: runVerificationStatusSchema,
  detail: z.string(),
  outputId: z.string().min(1).nullable().default(null),
});

export type RunVerificationFinding = z.infer<typeof runVerificationFindingSchema>;

export const runVerificationSchema = z.object({
  status: runVerificationStatusSchema,
  findings: z.array(runVerificationFindingSchema),
  checkedAt: z.string(),
});

export type RunVerification = z.infer<typeof runVerificationSchema>;

export const ROUTINE_SUCCESS_WINDOW_DAYS = 28;

export const routineKindSchema = z.enum(["recipe", "lead"]);

export type RoutineKind = z.infer<typeof routineKindSchema>;

export function leadRoutineId(workspaceId: string, kind: string): string {
  return `${workspaceId}:${kind}`;
}

export const routineSuccessSchema = z.object({
  routineId: z.string().min(1),
  kind: routineKindSchema,
  windowDays: z.number().int().positive(),
  runs: z.number().int().nonnegative(),
  verified: z.number().int().nonnegative(),
  unverified: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  falseCompletions: z.number().int().nonnegative(),
  successRate: z.number().min(0).max(1),
  lastStatus: runVerificationStatusSchema,
  lastRunAt: z.string(),
});

export type RoutineSuccess = z.infer<typeof routineSuccessSchema>;

export const routineSuccessListResponseSchema = listSchema(routineSuccessSchema);

export type RoutineSuccessListResponse = z.infer<typeof routineSuccessListResponseSchema>;
