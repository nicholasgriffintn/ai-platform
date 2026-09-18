export type ApprovalStatus = "pending" | "escalated" | "timed_out" | "approved" | "rejected";

export interface ApprovalWindow {
  timeoutSeconds: number;
  escalateAfterSeconds: number;
}

export interface ApprovalRecord {
  id: string;
  status: string;
  expiresAt?: string;
  escalatedAt?: string;
  timedOutAt?: string;
  resolutionReason?: string;
}

export interface ApprovalControlState {
  state?: string;
  cancellationReason?: string;
}

export interface ApprovalClient<TApproval extends ApprovalRecord = ApprovalRecord> {
  requestApproval(
    subject: string,
    reason: string,
    window: ApprovalWindow,
    abortSignal?: AbortSignal,
  ): Promise<TApproval | null>;
  fetchApproval(approvalId: string, abortSignal?: AbortSignal): Promise<TApproval | null>;
  fetchControlState?(abortSignal?: AbortSignal): Promise<ApprovalControlState | null>;
}
