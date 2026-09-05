import { isRecord } from "@ngriffin_uk/polychat-utility-core";

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

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readAuthoritativeState(
  data: Record<string, unknown>,
  approval: Record<string, unknown> | undefined,
  humanInTheLoop: Record<string, unknown> | undefined,
  expiresAt: string | undefined,
): ApprovalAuthoritativeState {
  const status = readString(data.status);
  const approvalStatus = readString(approval?.status);
  const humanStatus = readString(humanInTheLoop?.status);
  const resolution =
    readResolution(data.resolution) ??
    readResolution(humanInTheLoop?.resolution) ??
    readResolution(approvalStatus) ??
    readResolution(status);

  if (status === "expired" || approvalStatus === "expired" || humanStatus === "expired") {
    return { status: "expired" };
  }

  if (expiresAt) {
    const expiry = Date.parse(expiresAt);

    if (Number.isFinite(expiry) && expiry <= Date.now()) {
      return { status: "expired" };
    }
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
  const message = readString(data.message);
  const timestamp = readString(data.timestamp);
  const completionId = readString(data.completion_id);
  const interactionId = readString(approval?.interactionId);
  const toolName = readString(approval?.toolName);
  const expiresAt = readString(data.expiresAt) ?? readString(humanInTheLoop?.expiresAt);
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
