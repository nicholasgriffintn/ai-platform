import { isDeadlinePassed, isRecord, readNonEmptyString } from "@ngriffin_uk/polychat-utility-core";

export type ApprovalResolution = "approved" | "rejected";
export type ApprovalAuthoritativeState =
  | { status: "pending" }
  | { status: "expired" }
  | { status: "resolved"; resolution?: ApprovalResolution };

export interface ApprovalRequestData {
  key: string;
  message?: string;
  options?: string[];
  context?: unknown;
  expiresAt?: string;
  approval?: {
    interactionId?: string;
    toolName?: string;
  };
  authoritativeState: ApprovalAuthoritativeState;
}

function readResolution(value: unknown): ApprovalResolution | undefined {
  return value === "approved" || value === "rejected" ? value : undefined;
}

function readAuthoritativeState(
  data: Record<string, unknown>,
  approval: Record<string, unknown> | undefined,
  humanInTheLoop: Record<string, unknown> | undefined,
  expiresAt: string | undefined,
): ApprovalAuthoritativeState {
  const status = readNonEmptyString(data.status);
  const approvalStatus = readNonEmptyString(approval?.status);
  const humanStatus = readNonEmptyString(humanInTheLoop?.status);
  const resolution =
    readResolution(data.resolution) ??
    readResolution(humanInTheLoop?.resolution) ??
    readResolution(approvalStatus) ??
    readResolution(status);

  if (status === "expired" || approvalStatus === "expired" || humanStatus === "expired") {
    return { status: "expired" };
  }

  if (isDeadlinePassed(expiresAt)) {
    return { status: "expired" };
  }

  if (
    data.resolved === true ||
    status === "resolved" ||
    approvalStatus === "resolved" ||
    humanStatus === "resolved" ||
    resolution
  ) {
    return { status: "resolved", ...(resolution ? { resolution } : {}) };
  }

  return { status: "pending" };
}

export function readApprovalRequest(data: unknown): ApprovalRequestData {
  if (!isRecord(data)) {
    return { key: "approval", authoritativeState: { status: "pending" } };
  }

  const approval = isRecord(data.approval) ? data.approval : undefined;
  const humanInTheLoop = isRecord(data.humanInTheLoop) ? data.humanInTheLoop : undefined;
  const message = readNonEmptyString(data.message);
  const timestamp = readNonEmptyString(data.timestamp);
  const completionId = readNonEmptyString(data.completion_id);
  const interactionId = readNonEmptyString(approval?.interactionId);
  const toolName = readNonEmptyString(approval?.toolName);
  const expiresAt =
    readNonEmptyString(data.expiresAt) ?? readNonEmptyString(humanInTheLoop?.expiresAt);
  const options = Array.isArray(data.options)
    ? data.options.filter((option): option is string => typeof option === "string")
    : undefined;

  return {
    key: interactionId ?? completionId ?? timestamp ?? message ?? "approval",
    ...(message ? { message } : {}),
    ...(options ? { options } : {}),
    ...(data.context !== undefined ? { context: data.context } : {}),
    ...(expiresAt ? { expiresAt } : {}),
    ...(interactionId || toolName
      ? {
          approval: {
            ...(interactionId ? { interactionId } : {}),
            ...(toolName ? { toolName } : {}),
          },
        }
      : {}),
    authoritativeState: readAuthoritativeState(data, approval, humanInTheLoop, expiresAt),
  };
}
