import type { ConnectorOperationApprovalRecord } from "~/repositories/ConnectorOperationApprovalRepository";
import type { Message } from "~/types";
import { isRecord } from "~/utils/objects";

export type ConnectorApprovalDisplayState =
  | "pending"
  | "approved"
  | "rejected"
  | "consumed"
  | "expired";

interface ApprovalStateReader {
  getByIdsForUser(
    ids: readonly string[],
    userId: number,
  ): Promise<ConnectorOperationApprovalRecord[]>;
}

function getMessageApprovalId(message: Message): string | null {
  if (!isRecord(message.data) || message.data.approvalRequired !== true) {
    return null;
  }

  return typeof message.data.approvalId === "string" ? message.data.approvalId : null;
}

function getDisplayState(
  approval: ConnectorOperationApprovalRecord,
  now: string,
): ConnectorApprovalDisplayState {
  if (
    (approval.state === "pending" || approval.state === "approved") &&
    approval.expiresAt <= now
  ) {
    return "expired";
  }

  return approval.state;
}

function projectApprovalState(
  message: Message,
  approval: ConnectorOperationApprovalRecord,
  now: string,
): Message {
  const data = isRecord(message.data) ? message.data : {};
  const existingHumanState = isRecord(data.humanInTheLoop) ? data.humanInTheLoop : {};
  const status = getDisplayState(approval, now);

  return {
    ...message,
    data: {
      ...data,
      humanInTheLoop: {
        ...existingHumanState,
        type: "approval",
        status,
        requires_user_action: status === "pending",
        ...(approval.resolvedAt ? { resolvedAt: approval.resolvedAt } : {}),
        ...(approval.consumedAt ? { consumedAt: approval.consumedAt } : {}),
      },
    },
  };
}

export async function hydrateConnectorApprovalMessageState(params: {
  messages: Message[];
  userId: number;
  approvals: ApprovalStateReader;
  now?: string;
}): Promise<Message[]> {
  const approvalIds = params.messages
    .map(getMessageApprovalId)
    .filter((id): id is string => id !== null);

  if (approvalIds.length === 0) {
    return params.messages;
  }

  const approvals = await params.approvals.getByIdsForUser(approvalIds, params.userId);
  const approvalsById = new Map(approvals.map((approval) => [approval.id, approval]));
  const now = params.now ?? new Date().toISOString();

  return params.messages.map((message) => {
    const approvalId = getMessageApprovalId(message);
    const approval = approvalId ? approvalsById.get(approvalId) : undefined;

    return approval ? projectApprovalState(message, approval, now) : message;
  });
}
