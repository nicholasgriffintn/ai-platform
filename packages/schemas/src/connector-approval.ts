import { isRecord, titleCaseSlug } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

import { connectorApprovalIdSchema } from "./chat-completions";

export const connectorOperationApprovalStateSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "consumed",
  "expired",
]);

export const connectorOperationApprovalSchema = z.object({
  id: connectorApprovalIdSchema,
  runId: z.string().min(1),
  completionId: z.string().min(1),
  provider: z.string().min(1),
  operation: z.string().min(1),
  state: connectorOperationApprovalStateSchema,
  createdAt: z.string(),
  expiresAt: z.string(),
  resolvedAt: z.string().nullable(),
  consumedAt: z.string().nullable(),
});

export const connectorOperationApprovalResponseSchema = z.object({
  approval: connectorOperationApprovalSchema,
});

export interface ConnectorApprovalRequest {
  approvalId: string;
  expiresAt?: string;
  operation: string;
  provider: string;
  state: "pending" | "approved" | "rejected" | "consumed" | "expired";
}

const connectorApprovalStates = new Set(["pending", "approved", "rejected", "consumed", "expired"]);

function isConnectorApprovalState(value: unknown): value is ConnectorApprovalRequest["state"] {
  return typeof value === "string" && connectorApprovalStates.has(value);
}

export function readConnectorApprovalRequest(
  data: Record<string, unknown> | undefined,
): ConnectorApprovalRequest | null {
  if (data?.approvalRequired !== true) {
    return null;
  }

  const approvalId = connectorApprovalIdSchema.safeParse(data.approvalId);
  const operation = data.operation;
  const provider = data.provider;
  const humanInTheLoop = isRecord(data.humanInTheLoop) ? data.humanInTheLoop : undefined;
  const rawState = humanInTheLoop?.status;

  if (
    !approvalId.success ||
    typeof operation !== "string" ||
    !operation.trim() ||
    typeof provider !== "string" ||
    !provider.trim()
  ) {
    return null;
  }

  return {
    approvalId: approvalId.data,
    operation,
    provider,
    state: isConnectorApprovalState(rawState) ? rawState : "pending",
    ...(typeof data.expiresAt === "string" ? { expiresAt: data.expiresAt } : {}),
  };
}

export function formatConnectorLabel(value: string): string {
  return titleCaseSlug(value.toLowerCase());
}
