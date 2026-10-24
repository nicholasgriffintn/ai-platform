import { Button } from "@ngriffin_uk/polychat-component-ui";
import type { ToolApprovalBatch } from "@ngriffin_uk/polychat-library-react";

export function ToolApprovalBatchBar({ batch }: { batch: ToolApprovalBatch }) {
  const total = batch.pending.length;

  if (total < 2) {
    return null;
  }

  const remaining = total - batch.decidedCount;
  const canDecideRemaining = batch.pending.some((approval) => approval.approvalRequired);

  return (
    <section
      aria-labelledby="tool-approval-batch-title"
      className="space-y-2 rounded-xl border border-attention/45 bg-attention/12 p-3"
      data-poly-anchor="approval"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="tool-approval-batch-title" className="text-sm font-semibold text-foreground">
          {batch.isSubmitting
            ? `Sending ${total} decisions`
            : remaining > 0
              ? `${batch.decidedCount} of ${total} approvals decided`
              : `All ${total} approvals decided`}
        </h2>
        {remaining > 0 && canDecideRemaining && !batch.isSubmitting ? (
          <div className="ml-auto flex gap-2">
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => batch.decideRemaining("rejected")}
            >
              Reject {remaining}
            </Button>
            <Button type="button" size="xs" onClick={() => batch.decideRemaining("approved")}>
              Approve {remaining}
            </Button>
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Poly asked for these together, so your decisions go back together once each one is made.
      </p>
      {batch.error ? (
        <p role="alert" className="text-xs text-failure">
          {batch.error}
        </p>
      ) : null}
    </section>
  );
}
