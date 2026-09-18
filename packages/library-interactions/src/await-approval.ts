import { sleep } from "@ngriffin_uk/polychat-utility-core";

import type {
  ApprovalClient,
  ApprovalControlState,
  ApprovalRecord,
  ApprovalWindow,
} from "./approval-types.js";
import { InteractionError } from "./errors.js";

const DEFAULT_POLL_INTERVAL_MS = 2000;

export interface ResolveApprovalParams<
  TRisk extends string,
  TTrust extends string,
  TApproval extends ApprovalRecord = ApprovalRecord,
> {
  subject: string;
  riskLevel: TRisk;
  trustLevel: TTrust;
  reason: string;
  agentStep: number;
  emit: (event: Record<string, unknown>) => Promise<void>;
  guardExecution: (abortMessage: string) => Promise<void>;
  shouldRequireApproval: (params: { riskLevel: TRisk; trustLevel: TTrust }) => boolean;
  approvalWindowForRiskLevel: (riskLevel: TRisk) => ApprovalWindow;
  approvalClient?: ApprovalClient<TApproval>;
  abortSignal?: AbortSignal;
  pollIntervalMs?: number;
  eventPrefix?: string;
}

export interface ResolveApprovalResult<TApproval extends ApprovalRecord = ApprovalRecord> {
  approved: boolean;
  rejected: boolean;
  approval?: TApproval;
  rejectedMessage?: string;
}

export async function resolveApproval<
  TRisk extends string,
  TTrust extends string,
  TApproval extends ApprovalRecord = ApprovalRecord,
>(
  params: ResolveApprovalParams<TRisk, TTrust, TApproval>,
): Promise<ResolveApprovalResult<TApproval>> {
  const {
    subject,
    riskLevel,
    trustLevel,
    reason,
    agentStep,
    emit,
    guardExecution,
    approvalClient,
    abortSignal,
    shouldRequireApproval,
    approvalWindowForRiskLevel,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    eventPrefix = "approval",
  } = params;

  if (!shouldRequireApproval({ riskLevel, trustLevel })) {
    return {
      approved: true,
      rejected: false,
    };
  }

  if (!approvalClient) {
    throw new InteractionError(
      "approval_unavailable",
      `Approval required but no approval client is configured for: ${subject}`,
      { subject },
    );
  }

  const approval = await approvalClient.requestApproval(
    subject,
    reason,
    approvalWindowForRiskLevel(riskLevel),
    abortSignal,
  );

  if (!approval) {
    throw new InteractionError(
      "approval_request_failed",
      `Failed to create approval request for: ${subject}`,
      { subject },
    );
  }

  await emit({
    type: `${eventPrefix}_requested`,
    subject,
    riskLevel,
    trustLevel,
    agentStep,
    approvalId: approval.id,
    approvalStatus: approval.status,
    approvalExpiresAt: approval.expiresAt,
    approvalEscalatedAt: approval.escalatedAt,
  });

  let previousStatus = approval.status;

  while (true) {
    await guardExecution("Execution cancelled while waiting for approval");

    const control: ApprovalControlState | null = approvalClient.fetchControlState
      ? await approvalClient.fetchControlState(abortSignal)
      : null;

    if (control?.state === "cancelled") {
      throw new InteractionError(
        "approval_cancelled",
        control.cancellationReason || "Execution cancelled during approval wait",
        { subject, approvalId: approval.id },
      );
    }

    const latestApproval = await approvalClient.fetchApproval(approval.id, abortSignal);

    if (!latestApproval) {
      await sleep(pollIntervalMs);
      continue;
    }

    if (latestApproval.status === "escalated" && previousStatus !== "escalated") {
      await emit({
        type: `${eventPrefix}_escalated`,
        subject,
        riskLevel,
        trustLevel,
        agentStep,
        approvalId: latestApproval.id,
        approvalStatus: latestApproval.status,
        approvalEscalatedAt: latestApproval.escalatedAt,
        approvalExpiresAt: latestApproval.expiresAt,
      });
    }

    if (latestApproval.status === "approved") {
      await emit({
        type: `${eventPrefix}_resolved`,
        subject,
        riskLevel,
        trustLevel,
        agentStep,
        approvalId: latestApproval.id,
        approvalStatus: latestApproval.status,
        approvalEscalatedAt: latestApproval.escalatedAt,
        approvalExpiresAt: latestApproval.expiresAt,
        approvalResolutionReason: latestApproval.resolutionReason,
      });

      return {
        approved: true,
        rejected: false,
        approval: latestApproval,
      };
    }

    if (latestApproval.status === "rejected") {
      await emit({
        type: `${eventPrefix}_resolved`,
        subject,
        riskLevel,
        trustLevel,
        agentStep,
        approvalId: latestApproval.id,
        approvalStatus: latestApproval.status,
        approvalEscalatedAt: latestApproval.escalatedAt,
        approvalExpiresAt: latestApproval.expiresAt,
        approvalResolutionReason: latestApproval.resolutionReason,
      });

      return {
        approved: false,
        rejected: true,
        approval: latestApproval,
        rejectedMessage: latestApproval.resolutionReason || "Approval rejected",
      };
    }

    if (latestApproval.status === "timed_out") {
      await emit({
        type: `${eventPrefix}_timed_out`,
        subject,
        riskLevel,
        trustLevel,
        agentStep,
        approvalId: latestApproval.id,
        approvalStatus: latestApproval.status,
        approvalEscalatedAt: latestApproval.escalatedAt,
        approvalExpiresAt: latestApproval.expiresAt,
        approvalTimedOutAt: latestApproval.timedOutAt,
        approvalResolutionReason: latestApproval.resolutionReason,
      });

      return {
        approved: false,
        rejected: true,
        approval: latestApproval,
        rejectedMessage:
          latestApproval.resolutionReason || "Approval timed out before a decision was made",
      };
    }

    previousStatus = latestApproval.status;
    await sleep(pollIntervalMs);
  }
}
