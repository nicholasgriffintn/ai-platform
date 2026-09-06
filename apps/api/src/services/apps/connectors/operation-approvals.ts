import type { RecipeConnectorProvider } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { connectorOperationRequiresApproval } from "~/lib/providers/capabilities/connectors";
import type { ConnectorOperationApprovalRecord } from "~/repositories/ConnectorOperationApprovalRepository";
import { canonicalJson } from "~/utils/canonical-json";
import { sha256Hex } from "~/utils/crypto";
import { AssistantError, ErrorType } from "~/utils/errors";

import { getRecipeConnectorAdapter } from "./connector-adapters";
import type { ConnectorRunScope } from "./connector-run-scope";

const APPROVAL_TTL_MS = 10 * 60 * 1000;

export interface ConnectorOperationApprovalDecision {
  required: boolean;
  approved: boolean;
  connectedAccountId?: string;
  approval?: ConnectorOperationApprovalRecord;
}

export interface ConnectorOperationApprovalView {
  id: string;
  state: "approved" | "rejected";
  expiresAt: string;
  resolvedAt: string | null;
  consumedAt: string | null;
}

export interface ConnectorOperationApprovalStatusView {
  id: string;
  runId: string;
  completionId: string;
  provider: string;
  operation: string;
  state: "pending" | "approved" | "rejected" | "consumed" | "expired";
  createdAt: string;
  expiresAt: string;
  resolvedAt: string | null;
  consumedAt: string | null;
}

function toConnectorOperationApprovalStatusView(
  approval: ConnectorOperationApprovalRecord,
  now: string,
): ConnectorOperationApprovalStatusView {
  return {
    id: approval.id,
    runId: approval.runId,
    completionId: approval.completionId,
    provider: approval.provider,
    operation: approval.operation,
    state:
      (approval.state === "pending" || approval.state === "approved") && approval.expiresAt <= now
        ? "expired"
        : approval.state,
    createdAt: approval.createdAt,
    expiresAt: approval.expiresAt,
    resolvedAt: approval.resolvedAt,
    consumedAt: approval.consumedAt,
  };
}

function toConnectorOperationApprovalView(
  approval: ConnectorOperationApprovalRecord,
): ConnectorOperationApprovalView {
  if (approval.state !== "approved" && approval.state !== "rejected") {
    throw new AssistantError(
      "Connector approval has not been resolved",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  return {
    id: approval.id,
    state: approval.state,
    expiresAt: approval.expiresAt,
    resolvedAt: approval.resolvedAt,
    consumedAt: approval.consumedAt,
  };
}

export async function getConnectorArgumentDigest(params: {
  provider: RecipeConnectorProvider;
  operation: string;
  arguments: Record<string, unknown>;
}): Promise<string> {
  return sha256Hex(canonicalJson(params));
}

export async function authoriseConnectorOperation(params: {
  context: ServiceContext;
  userId: number;
  provider: RecipeConnectorProvider;
  operation: string;
  arguments: Record<string, unknown>;
  connectedAccountId?: string;
  channel: string;
  scope: ConnectorRunScope;
  approvalId?: string;
}): Promise<ConnectorOperationApprovalDecision> {
  if (!connectorOperationRequiresApproval(params.provider, params.operation)) {
    return { required: false, approved: true };
  }

  if (params.channel === "scheduled" || params.channel === "event") {
    throw new AssistantError(
      `${params.channel === "event" ? "Event-triggered" : "Scheduled"} recipe runs cannot perform connector write operations`,
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  const adapter = getRecipeConnectorAdapter(params.provider);

  if (adapter?.approval?.mode !== "stored-action") {
    return { required: false, approved: true };
  }

  if (!params.connectedAccountId) {
    throw new AssistantError(
      "A scoped connector session is required before approving this action",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  const argumentDigest = await getConnectorArgumentDigest({
    provider: params.provider,
    operation: params.operation,
    arguments: params.arguments,
  });
  const now = new Date().toISOString();

  if (params.approvalId) {
    const approval = await params.context.repositories.connectorOperationApprovals.consume({
      id: params.approvalId,
      userId: params.userId,
      runId: params.context.connectorRunId,
      completionId: params.scope.completionId,
      provider: params.provider,
      operation: params.operation,
      connectedAccountId: params.connectedAccountId,
      channel: params.channel,
      argumentDigest,
      consumedAt: now,
    });

    if (!approval) {
      throw new AssistantError(
        "Connector approval is invalid, expired, already used, or does not match this action",
        ErrorType.AUTHORISATION_ERROR,
        403,
      );
    }

    return {
      required: true,
      approved: true,
      connectedAccountId: params.connectedAccountId,
      approval,
    };
  }

  const approval = await params.context.repositories.connectorOperationApprovals.create({
    userId: params.userId,
    runId: params.context.connectorRunId,
    completionId: params.scope.completionId,
    provider: params.provider,
    operation: params.operation,
    connectedAccountId: params.connectedAccountId,
    channel: params.channel,
    argumentDigest,
    createdAt: now,
    expiresAt: new Date(Date.now() + APPROVAL_TTL_MS).toISOString(),
  });

  return {
    required: true,
    approved: false,
    connectedAccountId: params.connectedAccountId,
    approval,
  };
}

export async function resolveConnectorOperationApproval(params: {
  context: ServiceContext;
  userId: number;
  approvalId: string;
  resolution: "approved" | "rejected";
}): Promise<ConnectorOperationApprovalView> {
  const resolvedAt = new Date().toISOString();
  const approval = await params.context.repositories.connectorOperationApprovals.resolve({
    id: params.approvalId,
    userId: params.userId,
    resolution: params.resolution,
    resolvedAt,
  });

  if (approval) {
    return toConnectorOperationApprovalView(approval);
  }

  const existing = await params.context.repositories.connectorOperationApprovals.getByIdForUser(
    params.approvalId,
    params.userId,
  );

  if (
    existing?.state === params.resolution &&
    !existing.consumedAt &&
    existing.expiresAt > resolvedAt
  ) {
    return toConnectorOperationApprovalView(existing);
  }

  throw new AssistantError("Connector approval is invalid or expired", ErrorType.NOT_FOUND, 404);
}

export async function getConnectorOperationApproval(params: {
  context: ServiceContext;
  userId: number;
  approvalId: string;
  now?: string;
}): Promise<ConnectorOperationApprovalStatusView> {
  const approval = await params.context.repositories.connectorOperationApprovals.getByIdForUser(
    params.approvalId,
    params.userId,
  );

  if (!approval) {
    throw new AssistantError("Connector approval not found", ErrorType.NOT_FOUND, 404);
  }

  return toConnectorOperationApprovalStatusView(approval, params.now ?? new Date().toISOString());
}
