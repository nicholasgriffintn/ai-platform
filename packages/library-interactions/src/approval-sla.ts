/**
 * Pure SLA evaluation for pending approvals.
 *
 * A host stores `escalationAt` and `expiresAt` when it creates an approval.
 * The first fires escalation, the second fires timeout, and timeout wins when
 * both are due in the same pass so an overdue request never lingers as merely
 * escalated. The caller owns persistence and fills in "keep existing value"
 * defaults; this module only decides what is due.
 */

import { readOptionalString } from "@ngriffin_uk/polychat-utility-core";

export const APPROVAL_TIMEOUT_REASON = "Approval request timed out";

export interface ApprovalSlaState {
  status: "pending" | "escalated";
  escalationAt?: string | null;
  expiresAt?: string | null;
}

export interface ApprovalSlaTransition {
  status: "escalated" | "timed_out";
  escalatedAt?: string;
  timedOutAt?: string;
  resolvedAt?: string;
  resolutionReason?: string;
}

function isPast(value: string | null | undefined, nowMs: number): boolean {
  const timestamp = readOptionalString(value);

  return timestamp !== undefined && timestamp !== "" && Date.parse(timestamp) <= nowMs;
}

export function evaluateApprovalSla(
  state: ApprovalSlaState,
  now: Date = new Date(),
): ApprovalSlaTransition | null {
  const nowMs = now.getTime();
  const escalatedAt = now.toISOString();
  const escalationDue = state.status === "pending" && isPast(state.escalationAt, nowMs);
  const timeoutDue = isPast(state.expiresAt, nowMs);

  if (timeoutDue) {
    return {
      status: "timed_out",
      ...(escalationDue ? { escalatedAt } : {}),
      timedOutAt: escalatedAt,
      resolvedAt: escalatedAt,
      resolutionReason: APPROVAL_TIMEOUT_REASON,
    };
  }

  if (escalationDue) {
    return { status: "escalated", escalatedAt };
  }

  return null;
}
