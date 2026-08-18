import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import { connectorApprovalIdSchema } from "./chat-completions";

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
  return value
    .toLowerCase()
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
