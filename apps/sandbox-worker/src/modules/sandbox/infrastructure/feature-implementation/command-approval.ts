import { resolveApproval, type ApprovalClient } from "@ngriffin_uk/polychat-library-interactions";
import { sandboxRunEventSchema, type SandboxTrustLevel } from "@ngriffin_uk/polychat-schemas";
import { readNonEmptyString } from "@ngriffin_uk/polychat-utility-core";

import {
  NETWORK_APPROVAL_ESCALATE_AFTER_SECONDS,
  NETWORK_APPROVAL_TIMEOUT_SECONDS,
  RISKY_APPROVAL_ESCALATE_AFTER_SECONDS,
  RISKY_APPROVAL_TIMEOUT_SECONDS,
} from "../../../../config/agent";
import type { TaskEvent } from "../../../../types";
import type { CommandApproval, RunControlClient } from "../run-control-client";

type CommandRiskLevel = "low" | "network" | "risky";

function shouldRequireApproval(params: {
  trustLevel: SandboxTrustLevel;
  riskLevel: CommandRiskLevel;
  alwaysRequireApproval?: boolean;
}): boolean {
  if (params.alwaysRequireApproval) {
    return true;
  }

  if (params.trustLevel === "trusted") {
    return false;
  }

  if (params.trustLevel === "strict") {
    return params.riskLevel === "network" || params.riskLevel === "risky";
  }

  return params.riskLevel === "network";
}

function approvalWindowForRiskLevel(riskLevel: CommandRiskLevel): {
  timeoutSeconds: number;
  escalateAfterSeconds: number;
} {
  if (riskLevel === "risky") {
    return {
      timeoutSeconds: RISKY_APPROVAL_TIMEOUT_SECONDS,
      escalateAfterSeconds: RISKY_APPROVAL_ESCALATE_AFTER_SECONDS,
    };
  }

  return {
    timeoutSeconds: NETWORK_APPROVAL_TIMEOUT_SECONDS,
    escalateAfterSeconds: NETWORK_APPROVAL_ESCALATE_AFTER_SECONDS,
  };
}

export interface ResolveCommandApprovalParams {
  command: string;
  riskLevel: CommandRiskLevel;
  trustLevel: SandboxTrustLevel;
  agentStep: number;
  emit: (event: TaskEvent) => Promise<void>;
  approvalClient?: RunControlClient;
  abortSignal?: AbortSignal;
  guardExecution: (abortMessage: string) => Promise<void>;
  alwaysRequireApproval?: boolean;
}

export interface ResolveCommandApprovalResult {
  allowNetwork: boolean;
  allowRisky: boolean;
  rejected: boolean;
  rejectedMessage?: string;
}

function approvalEventMessage(event: Record<string, unknown>): string {
  if (event.type === "command_approval_requested") {
    return `Approval requested for ${String(event.riskLevel)} command`;
  }

  if (event.type === "command_approval_escalated") {
    return "Command approval escalated";
  }

  if (event.type === "command_approval_timed_out") {
    return readNonEmptyString(event.approvalResolutionReason) ?? "Command approval timed out";
  }

  if (event.type === "command_approval_resolved") {
    return event.approvalStatus === "approved"
      ? "Command approval granted"
      : "Command approval rejected";
  }

  return "Command approval updated";
}

function toTaskEvent(event: Record<string, unknown>, command: string): TaskEvent {
  return sandboxRunEventSchema.parse({
    ...event,
    command,
    message: approvalEventMessage(event),
  });
}

function approvalClientFor(client: RunControlClient): ApprovalClient<CommandApproval> {
  return {
    requestApproval: (subject, reason, window, signal) =>
      client.requestCommandApproval(subject, reason, window, signal),
    fetchApproval: (approvalId, signal) => client.fetchApproval(approvalId, signal),
    fetchControlState: (signal) => client.fetchControlState(signal),
  };
}

export async function resolveCommandApproval(
  params: ResolveCommandApprovalParams,
): Promise<ResolveCommandApprovalResult> {
  const {
    command,
    riskLevel,
    trustLevel,
    agentStep,
    emit,
    approvalClient,
    abortSignal,
    guardExecution,
    alwaysRequireApproval,
  } = params;

  if (!shouldRequireApproval({ trustLevel, riskLevel, alwaysRequireApproval })) {
    return {
      allowNetwork: false,
      allowRisky: false,
      rejected: false,
    };
  }

  if (!approvalClient) {
    throw new Error(`Command requires approval but approval client is unavailable: ${command}`);
  }

  const result = await resolveApproval<CommandRiskLevel, SandboxTrustLevel, CommandApproval>({
    subject: command,
    riskLevel,
    trustLevel,
    reason: `${riskLevel} command in ${trustLevel} trust mode`,
    agentStep,
    approvalClient: approvalClientFor(approvalClient),
    abortSignal,
    guardExecution,
    shouldRequireApproval: ({ riskLevel: level, trustLevel: trust }) =>
      shouldRequireApproval({ trustLevel: trust, riskLevel: level, alwaysRequireApproval }),
    approvalWindowForRiskLevel,
    eventPrefix: "command_approval",
    emit: async (event) => {
      await emit(toTaskEvent(event, command));
    },
  });

  if (result.approved) {
    return {
      allowNetwork: riskLevel === "network",
      allowRisky: riskLevel === "risky",
      rejected: false,
    };
  }

  const approval = result.approval;

  if (approval?.status === "timed_out") {
    return {
      allowNetwork: false,
      allowRisky: false,
      rejected: true,
      rejectedMessage:
        approval.resolutionReason ?? "Command approval timed out before a decision was made.",
    };
  }

  return {
    allowNetwork: false,
    allowRisky: false,
    rejected: true,
    rejectedMessage: approval?.resolutionReason ?? "Command approval rejected",
  };
}
