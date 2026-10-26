import z from "zod/v4";

import { chatRunStatusSchema, chatRunTriggerSchema } from "./chat-runs.js";
import { spendStateSchema } from "./usage.js";

export const governanceReportQuerySchema = z
  .object({
    period: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use a month such as 2026-10")
      .optional(),
  })
  .strict();

const countSchema = z.number().int().nonnegative();

export const governanceOperationCountSchema = z.object({
  provider: z.string(),
  operation: z.string(),
  count: countSchema,
});

export const governanceTeammateSpendSchema = z.object({
  teammateContextId: z.string(),
  teammateId: z.string().nullable(),
  teammateName: z.string(),
  creditMicros: countSchema,
  runCount: countSchema,
  capCreditMicros: z.number().int().positive().nullable(),
  state: spendStateSchema,
});

export const governanceReportSchema = z.object({
  period: z.string(),
  from: z.string(),
  to: z.string(),
  generatedAt: z.string(),
  runs: z.object({
    total: countSchema,
    failed: countSchema,
    startedByOthers: countSchema,
    byTrigger: z.partialRecord(chatRunTriggerSchema, countSchema),
    byStatus: z.partialRecord(chatRunStatusSchema, countSchema),
  }),
  approvals: z.object({
    requested: countSchema,
    approved: countSchema,
    rejected: countSchema,
    expired: countSchema,
    executed: countSchema,
    pending: countSchema,
    topOperations: z.array(governanceOperationCountSchema),
  }),
  standingApprovals: countSchema,
  spend: z.object({
    creditMicros: countSchema,
    teammates: z.array(governanceTeammateSpendSchema),
  }),
});

export type GovernanceReportQuery = z.infer<typeof governanceReportQuerySchema>;
export type GovernanceOperationCount = z.infer<typeof governanceOperationCountSchema>;
export type GovernanceTeammateSpend = z.infer<typeof governanceTeammateSpendSchema>;
export type GovernanceReport = z.infer<typeof governanceReportSchema>;
