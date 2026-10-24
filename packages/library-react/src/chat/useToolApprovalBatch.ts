import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import {
  collectPendingApprovals,
  type PendingApproval,
} from "@ngriffin_uk/polychat-library-chat/tool-results";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface ToolApprovalDecision {
  toolName: string;
  response: Record<string, unknown>;
}

export interface ToolApprovalBatch {
  pending: PendingApproval[];
  decidedCount: number;
  isSubmitting: boolean;
  error: string | null;
  record: (decision: ToolApprovalDecision) => boolean;
  decideRemaining: (resolution: "approved" | "rejected") => void;
}

function decisionFor(
  approval: PendingApproval,
  resolution: "approved" | "rejected",
): ToolApprovalDecision {
  return {
    toolName: approval.toolName,
    response: {
      option: resolution === "approved" ? "Approve" : "Reject",
      approvalRequired: true,
      interactionId: approval.interactionId,
      resolution,
    },
  };
}

export function useToolApprovalBatch({
  messages,
  isStreaming,
  submit,
}: {
  messages: readonly Message[];
  isStreaming: boolean;
  submit: (decisions: ToolApprovalDecision[]) => Promise<void>;
}): ToolApprovalBatch {
  const pending = useMemo(() => collectPendingApprovals(messages), [messages]);
  const [decisions, setDecisions] = useState<Record<string, ToolApprovalDecision>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittedKey = useRef<string | null>(null);
  const decidedCount = pending.filter((approval) => decisions[approval.interactionId]).length;
  const batchKey = pending.map((approval) => approval.interactionId).join("|");

  const record = useCallback(
    (decision: ToolApprovalDecision) => {
      const interactionId = decision.response.interactionId;

      if (
        typeof interactionId !== "string" ||
        !pending.some((approval) => approval.interactionId === interactionId)
      ) {
        return false;
      }

      setError(null);
      setDecisions((current) => ({ ...current, [interactionId]: decision }));

      return true;
    },
    [pending],
  );

  const decideRemaining = useCallback(
    (resolution: "approved" | "rejected") => {
      setDecisions((current) => {
        const next = { ...current };

        for (const approval of pending) {
          if (!next[approval.interactionId] && approval.approvalRequired) {
            next[approval.interactionId] = decisionFor(approval, resolution);
          }
        }

        return next;
      });
    },
    [pending],
  );

  useEffect(() => {
    const ready =
      pending.length > 0 &&
      decidedCount === pending.length &&
      !isStreaming &&
      !isSubmitting &&
      submittedKey.current !== batchKey;

    if (!ready) {
      return;
    }

    const batch = pending.flatMap((approval) => {
      const decision = decisions[approval.interactionId];

      return decision ? [decision] : [];
    });

    submittedKey.current = batchKey;
    setIsSubmitting(true);
    submit(batch)
      .then(() => setDecisions({}))
      .catch((cause: unknown) => {
        submittedKey.current = null;
        setError(getErrorMessage(cause, "The approvals could not be sent"));
      })
      .finally(() => setIsSubmitting(false));
  }, [batchKey, decidedCount, decisions, isStreaming, isSubmitting, pending, submit]);

  return { pending, decidedCount, isSubmitting, error, record, decideRemaining };
}
