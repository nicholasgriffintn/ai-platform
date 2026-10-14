import z from "zod/v4";

import { listQuerySchema, listSchema } from "./platform/list.js";

export const APPROVAL_KINDS = ["connector_operation", "task_input", "task_approval"] as const;

export const approvalKindSchema = z.enum(APPROVAL_KINDS);

export const approvalSchema = z.object({
  object: z.literal("approval"),
  id: z.string(),
  kind: approvalKindSchema,
  state: z.enum(["pending", "approved", "rejected", "consumed", "expired"]),
  title: z.string(),
  detail: z.string().nullable(),
  conversation_id: z.string().nullable(),
  response_id: z.string().nullable(),
  project_id: z.string().nullable(),
  provider: z.string().nullable(),
  operation: z.string().nullable(),
  created_at: z.string(),
  expires_at: z.string().nullable(),
  resolved_at: z.string().nullable(),
  consumed_at: z.string().nullable(),
  deep_link: z.string().nullable(),
});

export const approvalListSchema = listSchema(approvalSchema);

export const listApprovalsQuerySchema = listQuerySchema.extend({
  kind: approvalKindSchema.optional(),
});

export const approvalParamsSchema = z.object({ approval_id: z.string().min(1) });

export const resolveApprovalSchema = z.object({
  state: z.enum(["approved", "rejected"]),
});

export const standingApprovalSchema = z.object({
  object: z.literal("standing_approval"),
  id: z.string(),
  tool_name: z.string(),
  destination: z.string(),
  granted_at: z.string(),
  expires_at: z.string(),
});

export const standingApprovalListSchema = listSchema(standingApprovalSchema);

export const createStandingApprovalSchema = z.object({ interaction_id: z.string().min(1) });

export const standingApprovalParamsSchema = z.object({
  standing_approval_id: z.string().min(3),
});

export function standingApprovalId(toolName: string, destination: string): string {
  return `${toolName}:${destination}`;
}

export function parseStandingApprovalId(
  id: string,
): { toolName: string; destination: string } | null {
  const separator = id.indexOf(":");

  if (separator <= 0 || separator === id.length - 1) {
    return null;
  }

  return { toolName: id.slice(0, separator), destination: id.slice(separator + 1) };
}

export type ApprovalKind = z.infer<typeof approvalKindSchema>;
export type Approval = z.infer<typeof approvalSchema>;
export type StandingApproval = z.infer<typeof standingApprovalSchema>;
export type ResolveApproval = z.infer<typeof resolveApprovalSchema>;
