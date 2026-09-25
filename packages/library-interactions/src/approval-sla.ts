import { isDeadlinePassed } from "@ngriffin_uk/polychat-utility-core";

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

export function evaluateApprovalSla(
  state: ApprovalSlaState,
  now: Date = new Date(),
): ApprovalSlaTransition | null {
  const escalatedAt = now.toISOString();
  const escalationDue = state.status === "pending" && isDeadlinePassed(state.escalationAt, now);
  const timeoutDue = isDeadlinePassed(state.expiresAt, now);

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
