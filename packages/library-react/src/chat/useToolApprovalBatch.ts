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
  retry: () => void;
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
  const [retryAttempt, setRetryAttempt] = useState(0);
  const submittedKey = useRef<string | null>(null);
  const decidedCount = pending.filter((approval) => decisions[approval.interactionId]).length;
  const batchKey = pending.map((approval) => approval.interactionId).join("|");
  const submissionKey = `${batchKey}:${retryAttempt}`;

  const record = useCallback(
    (decision: ToolApprovalDecision) => {
      const interactionId = decision.response.interactionId;

      if (
        pending.length < 2 ||
        typeof interactionId !== "string" ||
        !pending.some((approval) => approval.interactionId === interactionId)
      ) {
        return false;
      }

      setError(null);
      submittedKey.current = null;
      setDecisions((current) => ({ ...current, [interactionId]: decision }));

      return true;
    },
    [pending],
  );

  const decideRemaining = useCallback(
    (resolution: "approved" | "rejected") => {
      setError(null);
      submittedKey.current = null;
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
      submittedKey.current !== submissionKey;

    if (!ready) {
      return;
    }

    const batch = pending.flatMap((approval) => {
      const decision = decisions[approval.interactionId];

      return decision ? [decision] : [];
    });

    submittedKey.current = submissionKey;
    setIsSubmitting(true);
    submit(batch)
      .then(() => setDecisions({}))
      .catch((cause: unknown) => {
        setError(getErrorMessage(cause, "The approvals could not be sent"));
      })
      .finally(() => setIsSubmitting(false));
  }, [submissionKey, decidedCount, decisions, isStreaming, isSubmitting, pending, submit]);

  return {
    pending,
    decidedCount,
    isSubmitting,
    error,
    record,
    decideRemaining,
    retry: () => {
      if (error && !isSubmitting) {
        setError(null);
        setRetryAttempt((attempt) => attempt + 1);
      }
    },
  };
}
