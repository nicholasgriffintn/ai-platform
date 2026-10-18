import { Button, Checkbox } from "@ngriffin_uk/polychat-component-ui";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

import type { ConversationAgentApproval } from "./AgentApprovalDock.js";

export const APPROVAL_BATCH_THRESHOLD = 3;

export function ApprovalBatchReview({
  pending,
  resolve,
}: {
  pending: readonly ConversationAgentApproval[];
  resolve: (requestId: string) => void;
}) {
  const approvable = pending.filter((entry) => entry.approval.decisions.includes("accept"));
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(() => new Set());
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = approvable.filter((entry) => !excluded.has(entry.approval.requestId));

  if (approvable.length < APPROVAL_BATCH_THRESHOLD) {
    return null;
  }

  const toggle = (requestId: string, include: boolean) =>
    setExcluded((current) => {
      const next = new Set(current);

      if (include) {
        next.delete(requestId);
      } else {
        next.add(requestId);
      }

      return next;
    });

  const approveSelected = async () => {
    setIsApproving(true);
    setError(null);

    try {
      for (const entry of selected) {
        await entry.answer("accept");
        resolve(entry.approval.requestId);
      }
    } catch (cause) {
      setError(
        getErrorMessage(cause, "One approval could not be sent, so the rest were held back"),
      );
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <section
      aria-labelledby="approval-batch-title"
      className="space-y-3 rounded-xl border border-border bg-surface p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="approval-batch-title" className="text-sm font-semibold text-foreground">
          {approvable.length} things are waiting for you
        </h2>
        <Button
          type="button"
          size="sm"
          variant="primary"
          className="ml-auto"
          disabled={selected.length === 0}
          isLoading={isApproving}
          onClick={() => void approveSelected()}
        >
          Approve {selected.length}
        </Button>
      </div>
      <ul className="max-h-56 space-y-1.5 overflow-y-auto">
        {approvable.map((entry) => {
          const inputId = `approval-batch-${entry.approval.requestId}`;

          return (
            <li key={entry.approval.requestId}>
              <label htmlFor={inputId} className="flex items-start gap-2 text-sm">
                <Checkbox
                  id={inputId}
                  className="mt-0.5"
                  checked={!excluded.has(entry.approval.requestId)}
                  disabled={isApproving}
                  onCheckedChange={(value) => toggle(entry.approval.requestId, value === true)}
                />
                <span className="min-w-0">
                  <span className="block truncate text-foreground">{entry.approval.title}</span>
                  {entry.approval.detail ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {entry.approval.detail}
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        Each ticked item is approved on its own, exactly as listed. Untick anything you want to look
        at first.
      </p>
      {error ? (
        <p role="alert" className="text-xs text-failure">
          {error}
        </p>
      ) : null}
    </section>
  );
}
